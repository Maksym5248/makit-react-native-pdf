#import "../ios/AmmoPdfGeometry.h"
#include <assert.h>

int main()
{
    assert(AmmoPdfValidRect(CGRectMake(10, 20, 30, 40)));
    assert(!AmmoPdfValidRect(CGRectNull));
    assert(!AmmoPdfValidRect(CGRectInfinite));
    assert(!AmmoPdfValidRect(CGRectZero));
    CGFloat invalid[] = {NAN, INFINITY, -INFINITY};
    for (CGFloat value : invalid) {
        assert(!AmmoPdfValidRect(CGRectMake(value, 0, 12, 8)));
        assert(!AmmoPdfValidRect(CGRectMake(0, value, 12, 8)));
        assert(!AmmoPdfValidRect(CGRectMake(0, 0, value, 8)));
        assert(!AmmoPdfValidRect(CGRectMake(0, 0, 12, value)));
        assert(!AmmoPdfValidPoint(CGPointMake(value, 0)));
        assert(!AmmoPdfValidPoint(CGPointMake(0, value)));
    }
    // Search geometry must remain finite across repeated viewport/zoom changes.
    for (int i = 1; i <= 10000; i++) {
        CGFloat scale = 0.6 + (i % 25) / 10.0;
        CGRect rect = CGRectApplyAffineTransform(CGRectMake(10, 20, 30, 40), CGAffineTransformMakeScale(scale, scale));
        assert(AmmoPdfValidRect(rect));
        assert(AmmoPdfValidSize(CGSizeMake(i % 2 ? 390 : 844, i % 2 ? 844 : 390)));
    }
    return 0;
}
