#pragma once

#import <CoreGraphics/CoreGraphics.h>
#import <math.h>

static inline bool AmmoPdfValidPoint(CGPoint point)
{
    return isfinite(point.x) && isfinite(point.y);
}

static inline bool AmmoPdfValidSize(CGSize size)
{
    return isfinite(size.width) && isfinite(size.height) && size.width > 0 && size.height > 0;
}

static inline bool AmmoPdfValidRect(CGRect rect)
{
    return !CGRectIsNull(rect) && !CGRectIsInfinite(rect) &&
        AmmoPdfValidPoint(rect.origin) && AmmoPdfValidSize(rect.size);
}

