#import "AmmoPdfSearch.h"
#import <PDFKit/PDFKit.h>

@implementation AmmoPdfSearch {
    dispatch_queue_t _queue;
    NSMutableDictionary<NSNumber *, PDFDocument *> *_documents;
    NSInteger _nextHandle;
    NSLock *_stateLock;
    NSMutableSet<NSNumber *> *_closedHandles;
}
RCT_EXPORT_MODULE(AmmoPdfSearch)
+ (BOOL)requiresMainQueueSetup { return NO; }
- (instancetype)init {
    if ((self = [super init])) {
        _queue = dispatch_queue_create("org.ammo.pdf.search", DISPATCH_QUEUE_SERIAL);
        _documents = [NSMutableDictionary new];
        _nextHandle = 1;
        _stateLock = [NSLock new];
        _closedHandles = [NSMutableSet new];
    }
    return self;
}
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeAmmoPdfSearchSpecJSI>(params);
}
- (void)open:(NSString *)path password:(NSString *)password resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    dispatch_async(_queue, ^{
        @autoreleasepool {
            if (![path hasPrefix:@"/"] || [path hasPrefix:@"//"]) { reject(@"PDF_OPEN", @"A local PDF path is required", nil); return; }
            PDFDocument *document = [[PDFDocument alloc] initWithURL:[NSURL fileURLWithPath:path]];
            if (!document || (document.isLocked && ![document unlockWithPassword:password])) {
                reject(@"PDF_OPEN", @"Cannot open PDF or invalid password", nil); return;
            }
            NSNumber *handle = @(self->_nextHandle++);
            self->_documents[handle] = document;
            resolve(@{@"handle": handle, @"pages": @(document.pageCount)});
        }
    });
}
- (void)searchPage:(double)handle page:(double)pageNumber query:(NSString *)query caseSensitive:(BOOL)caseSensitive resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    dispatch_async(_queue, ^{
        @autoreleasepool {
            PDFDocument *document = [self documentForHandle:handle];
            if (!document || pageNumber < 1 || pageNumber > document.pageCount || floor(pageNumber) != pageNumber || !query.length || query.length > 512) {
                reject(@"PDF_SEARCH", @"Invalid document, page or query", nil); return;
            }
            PDFPage *page = [document pageAtIndex:(NSUInteger)pageNumber - 1];
            NSString *text = page.string ?: @"";
            NSMutableArray *matches = [NSMutableArray new];
            NSString *pattern = [NSRegularExpression escapedPatternForString:query];
            NSRegularExpression *spaces = [NSRegularExpression regularExpressionWithPattern:@"\\s+" options:0 error:nil];
            pattern = [spaces stringByReplacingMatchesInString:pattern options:0 range:NSMakeRange(0, pattern.length) withTemplate:@"\\\\s+"];
            NSRegularExpression *expression = [NSRegularExpression regularExpressionWithPattern:pattern options:caseSensitive ? 0 : NSRegularExpressionCaseInsensitive error:nil];
            NSUInteger offset = 0;
            BOOL truncated = NO;
            while (offset < text.length) {
                NSRange range = [expression rangeOfFirstMatchInString:text options:0 range:NSMakeRange(offset, text.length - offset)];
                if (range.location == NSNotFound) break;
                if (matches.count == 256) { truncated = YES; break; }
                PDFSelection *selection = [page selectionForRange:range];
                NSMutableArray *rects = [NSMutableArray new];
                CGRect crop = [page boundsForBox:kPDFDisplayBoxCropBox];
                for (PDFSelection *line in selection.selectionsByLine) {
                    CGRect bounds = [line boundsForPage:page];
                    if (crop.size.width > 0 && crop.size.height > 0) [rects addObject:@{
                        @"x": @((CGRectGetMinX(bounds) - CGRectGetMinX(crop)) / crop.size.width),
                        @"y": @((CGRectGetMaxY(crop) - CGRectGetMaxY(bounds)) / crop.size.height),
                        @"width": @(bounds.size.width / crop.size.width), @"height": @(bounds.size.height / crop.size.height)}];
                    if (rects.count == 128) break;
                }
                NSUInteger contextStart = range.location > 40 ? range.location - 40 : 0;
                NSString *context = [text substringWithRange:NSMakeRange(contextStart, MIN(text.length - contextStart, range.length + 80))];
                [matches addObject:@{@"page": @(pageNumber), @"start": @(range.location), @"length": @(range.length), @"text": context, @"rects": rects}];
                offset = NSMaxRange(range);
            }
            resolve(@{@"matches": matches, @"hasText": @(text.length > 0), @"truncated": @(truncated)});
        }
    });
}
- (void)getPageText:(double)handle page:(double)pageNumber resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    dispatch_async(_queue, ^{
        @autoreleasepool {
            PDFDocument *document = [self documentForHandle:handle];
            if (!document || pageNumber < 1 || pageNumber > document.pageCount || floor(pageNumber) != pageNumber) {
                reject(@"PDF_TEXT", @"Invalid document or page", nil); return;
            }
            resolve([document pageAtIndex:(NSUInteger)pageNumber - 1].string ?: @"");
        }
    });
}
- (void)getPageInfo:(double)handle page:(double)pageNumber resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    dispatch_async(_queue, ^{
        @autoreleasepool {
            PDFDocument *document = [self documentForHandle:handle];
            if (!document || pageNumber < 1 || pageNumber > document.pageCount || floor(pageNumber) != pageNumber) {
                reject(@"PDF_PAGE", @"Invalid document or page", nil); return;
            }
            PDFPage *page = [document pageAtIndex:(NSUInteger)pageNumber - 1];
            CGRect crop = [page boundsForBox:kPDFDisplayBoxCropBox];
            resolve(@{@"width": @(crop.size.width), @"height": @(crop.size.height),
                      @"rotation": @((page.rotation % 360 + 360) % 360), @"hasText": @(page.string.length > 0)});
        }
    });
}
- (void)renderThumbnail:(double)handle page:(double)pageNumber maxSize:(double)maxSize resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    dispatch_async(_queue, ^{
        @autoreleasepool {
            PDFDocument *document = [self documentForHandle:handle];
            if (!document || pageNumber < 1 || pageNumber > document.pageCount || floor(pageNumber) != pageNumber || !isfinite(maxSize) || maxSize < 1) {
                reject(@"PDF_THUMBNAIL", @"Invalid document, page or size", nil); return;
            }
            PDFPage *page = [document pageAtIndex:(NSUInteger)pageNumber - 1];
            CGRect crop = [page boundsForBox:kPDFDisplayBoxCropBox];
            BOOL sideways = labs(page.rotation % 180) == 90;
            CGFloat width = sideways ? crop.size.height : crop.size.width;
            CGFloat height = sideways ? crop.size.width : crop.size.height;
            if (width <= 0 || height <= 0 || !page.pageRef) {
                reject(@"PDF_THUMBNAIL", @"Invalid page dimensions", nil); return;
            }
            CGFloat edge = MIN(512, ceil(maxSize));
            CGFloat ratio = edge / MAX(width, height);
            CGSize size = CGSizeMake(MAX(1, floor(width * ratio)), MAX(1, floor(height * ratio)));
            // Explicit scale=1 avoids allocating device-scale thumbnails on Retina displays.
            UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
            format.scale = 1;
            format.opaque = YES;
            UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:size format:format];
            UIImage *image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
                [[UIColor whiteColor] setFill];
                [context fillRect:CGRectMake(0, 0, size.width, size.height)];
                CGContextRef cg = context.CGContext;
                CGContextTranslateCTM(cg, 0, size.height);
                CGContextScaleCTM(cg, 1, -1);
                CGPDFPageRef reference = page.pageRef;
                CGContextConcatCTM(cg, CGPDFPageGetDrawingTransform(reference, kCGPDFCropBox, CGRectMake(0, 0, size.width, size.height), 0, YES));
                CGContextDrawPDFPage(cg, reference);
            }];
            NSData *png = UIImagePNGRepresentation(image);
            if (!png) { reject(@"PDF_THUMBNAIL", @"Cannot render thumbnail", nil); return; }
            resolve(@{@"uri": [@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]],
                      @"width": @(size.width), @"height": @(size.height)});
        }
    });
}
// Called on the serial document queue; close can mark a handle from the JS thread.
- (PDFDocument *)documentForHandle:(double)handle {
    [_stateLock lock];
    BOOL closed = [_closedHandles containsObject:@(handle)];
    [_stateLock unlock];
    return closed ? nil : _documents[@(handle)];
}
- (void)close:(double)handle {
    [_stateLock lock];
    [_closedHandles addObject:@(handle)];
    [_stateLock unlock];
    dispatch_async(_queue, ^{
        [self->_documents removeObjectForKey:@(handle)];
        [self->_stateLock lock];
        [self->_closedHandles removeObject:@(handle)];
        [self->_stateLock unlock];
    });
}
- (void)invalidate { dispatch_async(_queue, ^{ [self->_documents removeAllObjects]; }); }
@end
