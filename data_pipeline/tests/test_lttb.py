"""LTTB downsampling tests."""

import pytest

from data_pipeline.lttb import lttb, lttb_2d


def test_returns_input_when_within_threshold():
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert lttb(values, 14) == values


def test_downsampled_length_matches_target():
    values = [float(i) for i in range(100)]
    result = lttb(values, 14)
    assert len(result) == 14
    assert 12 <= len(result) <= 15


def test_preserves_first_and_last():
    values = [float(i * i) for i in range(50)]
    result = lttb(values, 14)
    assert result[0] == values[0]
    assert result[-1] == values[-1]


def test_keeps_peak_spike():
    # A single dominant spike must survive downsampling.
    values = [1.0] * 40 + [1000.0] + [1.0] * 40
    result = lttb(values, 14)
    assert max(result) == 1000.0


def test_monotonic_series_shape():
    # Endpoints and monotonicity of the sampled extremes.
    values = [float(i) for i in range(200)]
    result = lttb(values, 14)
    assert result == sorted(result)


def test_threshold_two_keeps_endpoints():
    values = [float(i) for i in range(10)]
    result = lttb(values, 3)
    assert result[0] == values[0]
    assert result[-1] == values[-1]
    assert len(result) == 3


def test_invalid_threshold_raises():
    with pytest.raises(ValueError):
        lttb([1.0, 2.0, 3.0, 4.0, 5.0], 2)


def test_empty_and_single_series():
    assert lttb([], 14) == []
    assert lttb([5.0], 14) == [5.0]


def test_2d_downsample_shape_and_endpoints():
    points = [(i, i % 7) for i in range(60)]
    result = lttb_2d(points, 14)
    assert len(result) == 14
    assert result[0] == [0.0, 0.0]
    assert result[-1] == [59.0, 3.0]


def test_2d_keeps_input_within_threshold():
    points = [(i, i) for i in range(5)]
    assert lttb_2d(points, 14) == [[float(x), float(y)] for x, y in points]


def test_2d_keeps_large_removed_spike():
    # A bucket with a huge "removed" value must not be flattened away.
    points = [(i, 1.0) for i in range(40)] + [(40, 500.0)] + [(i, 1.0) for i in range(41, 81)]
    result = lttb_2d(points, 14)
    assert max(p[1] for p in result) == 500.0
