import { Pipeline, createPipeline } from './pipeline';

describe('Pipeline', () => {
    let pipeline: Pipeline;

    beforeEach(() => {
        pipeline = createPipeline();
    });

    afterEach(() => {
        pipeline.removeAll();
    });

    it('should emit and listen to events', () => {
        const mockListener = jest.fn();
        pipeline.on('log', mockListener);

        pipeline.emit('log', 'Test Message');

        expect(mockListener).toHaveBeenCalledTimes(1);
        expect(mockListener).toHaveBeenCalledWith('Test Message');
    });

    it('should handle removing a listener', () => {
        const mockListener = jest.fn();
        pipeline.on('log', mockListener);
        pipeline.off('log', mockListener);

        pipeline.emit('log', 'Test Message');

        expect(mockListener).not.toHaveBeenCalled();
    });

    it('should fire exactly once when using `once`', () => {
        const mockListener = jest.fn();
        pipeline.once('action:minimize', mockListener);

        pipeline.emit('action:minimize');
        pipeline.emit('action:minimize');

        expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners correctly', () => {
        const mockListener1 = jest.fn();
        const mockListener2 = jest.fn();

        pipeline.on('log', mockListener1);
        pipeline.on('action:reload', mockListener2);

        pipeline.removeAll();

        pipeline.emit('log', 'Foo');
        pipeline.emit('action:reload');

        expect(mockListener1).not.toHaveBeenCalled();
        expect(mockListener2).not.toHaveBeenCalled();
    });

    it('should report the correct listener count', () => {
        const mockListener = jest.fn();
        pipeline.on('log', mockListener);
        pipeline.on('log', mockListener); // Node events allow duplicate exact listeners

        expect(pipeline.listenerCount('log')).toBe(2);

        pipeline.off('log', mockListener);
        // Only removes one instance in Node EventEmitter
        expect(pipeline.listenerCount('log')).toBe(1);
    });
});
