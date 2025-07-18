/**
 * Tests for EventBus functionality
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventBus, TypedEventBus } from '../../../src/core/event-bus';

describe('TypedEventBus', () => {
  let eventBus;
  
  beforeEach(() => {
    eventBus = new TypedEventBus();
  });
  
  test('should emit and receive events', () => {
    const listener = jest.fn();
    eventBus.on('test-event', listener);
    
    eventBus.emit('test-event', { data: 'test-data' });
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ data: 'test-data' });
  });
  
  test('should support multiple listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    eventBus.on('multi-listener', listener1);
    eventBus.on('multi-listener', listener2);
    
    eventBus.emit('multi-listener', 'test');
    
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
  
  test('should support once listeners', () => {
    const listener = jest.fn();
    eventBus.once('once-event', listener);
    
    eventBus.emit('once-event', 'first');
    eventBus.emit('once-event', 'second');
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });
  
  test('should remove listeners with off', () => {
    const listener = jest.fn();
    eventBus.on('remove-test', listener);
    
    eventBus.emit('remove-test');
    expect(listener).toHaveBeenCalledTimes(1);
    
    eventBus.off('remove-test', listener);
    eventBus.emit('remove-test');
    expect(listener).toHaveBeenCalledTimes(1); // Count hasn't increased
  });
});

describe('EventBus singleton', () => {
  let eventBus;
  
  beforeEach(() => {
    eventBus = EventBus.getInstance();
    eventBus.removeAllListeners();
  });
  
  test('should return the same instance', () => {
    const instance1 = EventBus.getInstance();
    const instance2 = EventBus.getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  test('should emit and receive events', () => {
    const listener = jest.fn();
    eventBus.on('singleton-test', listener);
    
    eventBus.emit('singleton-test', 'data');
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('data');
  });
});