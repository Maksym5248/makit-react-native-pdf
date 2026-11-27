import { ThumbnailLoader } from '../src/pdf-thumbnails/thumbnail-loader';

const tick = () => new Promise(resolve => setImmediate(resolve));
const thumbnail = page => ({ uri: `data:image/png;base64,${page}`, width: 100, height: 160 });

test('replaces queued work when scrolling and discards an obsolete in-flight result', async () => {
    let finish;
    const renderThumbnail = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finish = resolve;
                }),
        )
        .mockImplementation(async page => thumbnail(page));
    const changed = jest.fn();
    const loader = new ThumbnailLoader({ pages: 100, renderThumbnail }, changed, jest.fn());
    loader.setPages([1, 2, 3]);
    loader.setPages([50, 51]);
    expect(renderThumbnail).toHaveBeenCalledTimes(1);
    finish(thumbnail(1));
    await tick();
    expect(renderThumbnail.mock.calls.map(call => call[0])).toEqual([1, 50, 51]);
    expect([...changed.mock.calls.at(-1)[0].keys()]).toEqual([50, 51]);
});

test('renders every visible page on large screens and retains only the current window', async () => {
    const renderThumbnail = jest.fn(async page => thumbnail(page));
    const changed = jest.fn();
    const loader = new ThumbnailLoader({ pages: 1000, renderThumbnail }, changed, jest.fn());
    loader.setPages(Array.from({ length: 21 }, (_, index) => index + 1));
    await tick();
    expect(renderThumbnail).toHaveBeenCalledTimes(21);
    expect(changed.mock.calls.at(-1)[0].size).toBe(21);
    loader.setPages([2, 3]);
    await tick();
    expect(renderThumbnail).toHaveBeenCalledTimes(21);
    expect([...changed.mock.calls.at(-1)[0].keys()]).toEqual([2, 3]);
});

test('dispose cancels queued thumbnails and suppresses late callbacks', async () => {
    let finish;
    const renderThumbnail = jest.fn(
        () =>
            new Promise(resolve => {
                finish = resolve;
            }),
    );
    const changed = jest.fn();
    const loader = new ThumbnailLoader({ pages: 10, renderThumbnail }, changed, jest.fn());
    loader.setPages([1, 2]);
    loader.dispose();
    changed.mockClear();
    finish(thumbnail(1));
    await tick();
    expect(changed).not.toHaveBeenCalled();
    expect(renderThumbnail).toHaveBeenCalledTimes(1);
});

test('a failed page does not spin or prevent rendering the next page', async () => {
    const error = new Error('Bad page');
    const renderThumbnail = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(thumbnail(2));
    const onError = jest.fn();
    const loader = new ThumbnailLoader({ pages: 2, renderThumbnail }, jest.fn(), onError);
    loader.setPages([1, 2]);
    await tick();
    expect(onError).toHaveBeenCalledWith(error);
    expect(renderThumbnail).toHaveBeenCalledTimes(2);
});

test('encoded data stays below the byte cap without an eviction/rerender loop', async () => {
    const renderThumbnail = jest.fn(async () => ({ uri: 'x'.repeat(700000), width: 160, height: 160 }));
    const changed = jest.fn();
    const loader = new ThumbnailLoader({ pages: 3, renderThumbnail }, changed, jest.fn());
    loader.setPages([1, 2, 3]);
    await tick();
    expect(renderThumbnail).toHaveBeenCalledTimes(3);
    for (const [images] of changed.mock.calls) {
        expect([...images.values()].reduce((size, image) => size + image.uri.length * 2, 0)).toBeLessThanOrEqual(2097152);
    }
});
