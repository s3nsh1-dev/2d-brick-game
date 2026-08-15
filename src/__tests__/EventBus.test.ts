import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../core/EventBus';

interface TestEvents {
  ping: [];
  scored: [points: number, total: number];
  named: [who: string];
}

describe('EventBus', () => {
  it('delivers an emit to a listener with its payload', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('scored', listener);
    bus.emit('scored', 5, 12);

    expect(listener).toHaveBeenCalledExactlyOnceWith(5, 12);
  });

  it('delivers to every listener of an event', () => {
    const bus = new EventBus<TestEvents>();
    const first = vi.fn();
    const second = vi.fn();

    bus.on('ping', first);
    bus.on('ping', second);
    bus.emit('ping');

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not deliver across event names', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('ping', listener);
    bus.emit('named', 'nobody');

    expect(listener).not.toHaveBeenCalled();
  });

  it('emitting an event nobody listens to is a no-op', () => {
    const bus = new EventBus<TestEvents>();

    expect(() => {
      bus.emit('ping');
    }).not.toThrow();
  });

  it('registers a given listener once, however many times it is added', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('ping', listener);
    bus.on('ping', listener);
    bus.emit('ping');

    expect(listener).toHaveBeenCalledOnce();
    expect(bus.listenerCount('ping')).toBe(1);
  });

  it('stops delivering after off', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('ping', listener);
    bus.off('ping', listener);
    bus.emit('ping');

    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('off on a listener that was never added is a no-op', () => {
    const bus = new EventBus<TestEvents>();

    expect(() => {
      bus.off('ping', vi.fn());
    }).not.toThrow();
  });

  it('drops everything on clear', () => {
    const bus = new EventBus<TestEvents>();
    const first = vi.fn();
    const second = vi.fn();

    bus.on('ping', first);
    bus.on('scored', second);
    bus.clear();
    bus.emit('ping');
    bus.emit('scored', 1, 1);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
    expect(bus.listenerCount('scored')).toBe(0);
  });

  // Scene shutdown unsubscribes from inside a handler, so dispatch has to tolerate the set
  // changing underneath it.
  it('keeps dispatching when a listener unsubscribes itself mid-emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const first = vi.fn(() => {
      bus.off('ping', first);
    });

    bus.on('ping', first);
    bus.on('ping', second);
    bus.emit('ping');

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    bus.emit('ping');

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('counts zero for an event never subscribed to', () => {
    const bus = new EventBus<TestEvents>();

    expect(bus.listenerCount('named')).toBe(0);
  });
});
