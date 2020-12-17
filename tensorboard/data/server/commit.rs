/* Copyright 2020 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

//! Shared state for sampled data available to readers.

use std::collections::HashMap;
use std::sync::RwLock;

use crate::proto::tensorboard as pb;
use crate::reservoir::Basin;
use crate::types::{Run, Step, Tag, WallTime};

/// Current state of in-memory sampled data.
///
/// A commit is an internally mutable structure. All readers and writers should keep a shared
/// reference to a single commit. When writers need to update it, they grab an exclusive lock to
/// the contents.
///
/// Deadlock safety: any thread should obtain the outer lock (around the hash map) before an inner
/// lock (around the run data), and should obtain at most one `RunData` lock at once.
#[derive(Debug, Default)]
pub struct Commit {
    pub runs: RwLock<HashMap<Run, RwLock<RunData>>>,
}

impl Commit {
    /// Creates a new, empty commit.
    pub fn new() -> Self {
        Commit::default()
    }
}

/// Data for a single run.
///
/// This contains all data and metadata for a run. For now, that data includes only scalars;
/// tensors and blob sequences will come soon.
#[derive(Debug, Default)]
pub struct RunData {
    /// The time of the first event recorded for this run.
    ///
    /// Used to define an ordering on runs that is stable as new runs are added, so that existing
    /// runs aren't constantly changing color.
    pub start_time: Option<WallTime>,

    /// Scalar time series for this run.
    pub scalars: TagStore<ScalarValue>,
}

pub type TagStore<V> = HashMap<Tag, TimeSeries<V>>;

#[derive(Debug)]
pub struct TimeSeries<V> {
    /// Summary metadata for this time series.
    pub metadata: Box<pb::SummaryMetadata>,

    /// Reservoir basin for data points in this time series.
    ///
    /// See [`TimeSeries::valid_values`] for a client-friendly view that omits `DataLoss` points
    /// and transposes `Step`s into the tuple.
    pub basin: Basin<(WallTime, Result<V, DataLoss>)>,
}

impl<V> TimeSeries<V> {
    /// Creates a new time series from the given summary metadata.
    pub fn new(metadata: Box<pb::SummaryMetadata>) -> Self {
        TimeSeries {
            metadata,
            basin: Basin::new(),
        }
    }

    /// Gets an iterator over `self.values` that omits `DataLoss` points.
    pub fn valid_values(&self) -> impl Iterator<Item = (Step, WallTime, &V)> {
        self.basin
            .as_slice()
            .iter()
            .filter_map(|(step, (wall_time, v))| Some((*step, *wall_time, v.as_ref().ok()?)))
    }
}

/// A value in a time series is corrupt and should be ignored.
///
/// This is used when a point looks superficially reasonable when it's offered to the reservoir,
/// but at commit time we realize that it can't be enriched into a valid point. This might happen
/// if, for instance, a point in a scalar time series has a tensor value containing a string. We
/// don't care too much about what happens to these invalid values. Keeping them in the commit as
/// `DataLoss` tombstones is convenient, and [`TimeSeries::valid_values`] offers a view that
/// abstracts over this detail by only showing valid data.
#[derive(Debug, PartialEq)]
pub struct DataLoss;

/// The value of a scalar time series at a single point.
#[derive(Debug, Copy, Clone, PartialEq)]
pub struct ScalarValue(pub f32);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_values() {
        let mut ts = TimeSeries::<&str>::new(Box::new(pb::SummaryMetadata::default()));

        let mut rsv = crate::reservoir::StageReservoir::new(10);
        let wall_time = WallTime::new(0.0).unwrap(); // don't really care
        rsv.offer(Step(0), "zero");
        rsv.offer(Step(1), "one");
        rsv.offer(Step(2), "two");
        rsv.offer(Step(3), "three");
        rsv.offer(Step(5), "five");
        rsv.commit_map(&mut ts.basin, |s| {
            (wall_time, if s == "three" { Err(DataLoss) } else { Ok(s) })
        });

        assert_eq!(
            ts.valid_values().collect::<Vec<_>>(),
            vec![
                (Step(0), wall_time, &"zero"),
                (Step(1), wall_time, &"one"),
                (Step(2), wall_time, &"two"),
                // missing: Step(3)
                (Step(5), wall_time, &"five")
            ]
        );
    }
}

/// Utilities for constructing commits with test data.
//
// Not `#[cfg(test)]` because we have a doctest:
// <https://github.com/rust-lang/rust/issues/45599>
pub mod test_data {
    use super::*;
    use crate::data_compat;
    use crate::reservoir::StageReservoir;

    #[derive(Default)]
    pub struct CommitBuilder(Commit);

    impl CommitBuilder {
        /// Creates a new builder for an empty commit.
        pub fn new() -> Self {
            Self::default()
        }

        /// Ensures that data for a run exists, and update it.
        ///
        /// This takes a callback because we can't just return a mutable reference, since there are
        /// nested `RwLockWriteGuard`s.
        fn with_run_data(&self, run: Run, update: impl FnOnce(&mut RunData)) {
            let mut runs = self.0.runs.write().expect("runs.write");
            let mut run_data = runs
                .entry(run)
                .or_default()
                .write()
                .expect("runs[run].write");
            update(&mut run_data);
        }

        /// Adds a scalar time series, creating the run if it doesn't exist, and setting its start
        /// time if unset.
        ///
        /// # Examples
        ///
        /// ```
        /// use rustboard_core::commit::{test_data::CommitBuilder, Commit};
        /// use rustboard_core::types::Step;
        ///
        /// let my_commit: Commit = CommitBuilder::new()
        ///     .scalars("train", "xent", |mut b| {
        ///         b.eval(|Step(i)| 1.0 / (i + 1) as f32).build()
        ///     })
        ///     .build();
        /// ```
        pub fn scalars(
            self,
            run: &str,
            tag: &str,
            build: impl FnOnce(ScalarTimeSeriesBuilder) -> TimeSeries<ScalarValue>,
        ) -> Self {
            self.with_run_data(Run(run.to_string()), |run_data| {
                let time_series = build(ScalarTimeSeriesBuilder::default());
                if let (None, Some((_step, wall_time, _value))) =
                    (run_data.start_time, time_series.valid_values().next())
                {
                    run_data.start_time = Some(wall_time);
                }
                run_data.scalars.insert(Tag(tag.to_string()), time_series);
            });
            self
        }

        /// Ensures that a run is present and sets its start time.
        ///
        /// If you don't care about the start time and the run is going to have data, anyway, you
        /// can just add the data directly, which will create the run as a side effect.
        ///
        /// # Panics
        ///
        /// If `start_time` represents an invalid wall time (i.e., `start_time` is `Some(wt)` but
        /// `WallTime::new(wt)` is `None`).
        pub fn run(self, run: &str, start_time: Option<f64>) -> Self {
            self.with_run_data(Run(run.to_string()), |run_data| {
                run_data.start_time = start_time.map(|f| WallTime::new(f).unwrap());
            });
            self
        }

        /// Consumes this `CommitBuilder` and returns the underlying commit.
        pub fn build(self) -> Commit {
            self.0
        }
    }

    pub struct ScalarTimeSeriesBuilder {
        /// Initial step. Increments by `1` for each point.
        step_start: Step,
        /// Initial wall time. Increments by `1.0` for each point.
        wall_time_start: WallTime,
        /// Number of points in this time series.
        len: u64,
        /// Custom summary metadata. Leave `None` to use default.
        metadata: Option<Box<pb::SummaryMetadata>>,
        /// Scalar evaluation function, called for each point in the series.
        ///
        /// By default, this maps every step to `0.0`.
        eval: Box<dyn Fn(Step) -> f32>,
    }

    impl Default for ScalarTimeSeriesBuilder {
        fn default() -> Self {
            ScalarTimeSeriesBuilder {
                step_start: Step(0),
                wall_time_start: WallTime::new(0.0).unwrap(),
                len: 1,
                metadata: None,
                eval: Box::new(|_| 0.0),
            }
        }
    }

    impl ScalarTimeSeriesBuilder {
        pub fn step_start(&mut self, raw_step: i64) -> &mut Self {
            self.step_start = Step(raw_step);
            self
        }
        pub fn wall_time_start(&mut self, raw_wall_time: f64) -> &mut Self {
            self.wall_time_start = WallTime::new(raw_wall_time).unwrap();
            self
        }
        pub fn len(&mut self, len: u64) -> &mut Self {
            self.len = len;
            self
        }
        pub fn metadata(&mut self, metadata: Option<Box<pb::SummaryMetadata>>) -> &mut Self {
            self.metadata = metadata;
            self
        }
        pub fn eval(&mut self, eval: impl Fn(Step) -> f32 + 'static) -> &mut Self {
            self.eval = Box::new(eval);
            self
        }

        /// Constructs a scalar time series from the state of this builder.
        ///
        /// # Panics
        ///
        /// If the wall time of a point would overflow to be infinite.
        pub fn build(&self) -> TimeSeries<ScalarValue> {
            let metadata = self.metadata.clone().unwrap_or_else(|| {
                let sample_point = Box::new(pb::summary::value::Value::SimpleValue(0.0));
                data_compat::SummaryValue(sample_point).initial_metadata(None)
            });
            let mut time_series = TimeSeries::new(metadata);

            let mut rsv = StageReservoir::new(self.len as usize);
            for i in 0..self.len {
                let step = Step(self.step_start.0 + i as i64);
                let wall_time =
                    WallTime::new(f64::from(self.wall_time_start) + (i as f64)).unwrap();
                let value = (self.eval)(step);
                rsv.offer(step, (wall_time, Ok(ScalarValue(value))));
            }
            rsv.commit(&mut time_series.basin);

            time_series
        }
    }
}
