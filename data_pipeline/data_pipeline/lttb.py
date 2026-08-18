"""LTTB (Largest Triangle Three Buckets) downsampling.

Standard 1-D LTTB preserves visual shape by greedily picking, for each bucket
of candidates, the point that forms the largest triangle with the previously
selected point and the average of the next bucket.

``lttb_2d`` is the same selection rule for 2-D points (used for the
``locDelta`` [added, removed] sparkline): each bucket's "next average" is the
2-D mean, and the triangle area is the magnitude of the cross product.

Both variants always keep the first and last points and return the input
unchanged when it is already within the target width.
"""

from __future__ import annotations

from typing import Sequence, TypeVar

T = TypeVar("T")

_PAIR = tuple[float, float]


def lttb(values: Sequence[float], threshold: int) -> list[float]:
    """Downsample a 1-D series to at most ``threshold`` points (≥ 2)."""
    n = len(values)
    if n <= threshold:
        return list(values)
    if n < 3:
        return list(values)
    if threshold < 3:
        raise ValueError("threshold must be >= 3 for downsampling")
    sampled = [values[0]]
    bucket_size = (n - 2) / (threshold - 2)
    a = 0  # index of the previously selected point
    for i in range(threshold - 2):
        # Range of candidates for this bucket.
        start = int(round(1 + i * bucket_size))
        end = int(round(1 + (i + 1) * bucket_size))
        end = min(end, n - 1)
        # Average of the *next* bucket (bounded to a single point at the end).
        next_start = int(round(1 + (i + 1) * bucket_size))
        next_end = int(round(1 + (i + 2) * bucket_size))
        next_end = min(next_end, n - 1)
        next_start = min(next_start, n - 1)
        avg_x = (next_start + next_end) / 2.0
        avg_y = sum(values[next_start : next_end + 1]) / (next_end - next_start + 1)
        # Pick the candidate maximizing triangle area with (a, avg_next).
        best = start
        best_area = -1.0
        ax, ay = a, values[a]
        for j in range(start, end + 1):
            area = abs((ax - avg_x) * (values[j] - ay) - (ax - j) * (avg_y - ay))
            if area > best_area:
                best_area = area
                best = j
        sampled.append(values[best])
        a = best
    sampled.append(values[-1])
    return sampled


def lttb_2d(points: Sequence[_PAIR], threshold: int) -> list[list[float]]:
    """Downsample a series of 2-D points to at most ``threshold`` points."""
    n = len(points)
    if n <= threshold:
        return [[float(x), float(y)] for x, y in points]
    if n < 3:
        return [[float(x), float(y)] for x, y in points]
    if threshold < 3:
        raise ValueError("threshold must be >= 3 for downsampling")
    sampled: list[list[float]] = [[float(points[0][0]), float(points[0][1])]]
    bucket_size = (n - 2) / (threshold - 2)
    a = 0
    for i in range(threshold - 2):
        start = int(round(1 + i * bucket_size))
        end = int(round(1 + (i + 1) * bucket_size))
        end = min(end, n - 1)
        next_start = int(round(1 + (i + 1) * bucket_size))
        next_end = int(round(1 + (i + 2) * bucket_size))
        next_end = min(next_end, n - 1)
        next_start = min(next_start, n - 1)
        block = points[next_start : next_end + 1]
        avg_x = sum(p[0] for p in block) / len(block)
        avg_y = sum(p[1] for p in block) / len(block)
        best = start
        best_area = -1.0
        ax, ay = points[a]
        for j in range(start, end + 1):
            x, y = points[j]
            area = abs((ax - avg_x) * (y - ay) - (ax - x) * (avg_y - ay))
            if area > best_area:
                best_area = area
                best = j
        x, y = points[best]
        sampled.append([float(x), float(y)])
        a = best
    sampled.append([float(points[-1][0]), float(points[-1][1])])
    return sampled
