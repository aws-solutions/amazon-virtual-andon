// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { sendAnonymousMetric } from '../metrics';
import axios from 'axios';

// Mock Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Spy on the console messages
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

describe('sendAnonymousMetric', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV };
        jest.resetModules();
        consoleLogSpy.mockClear();
        consoleErrorSpy.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    test('Valid metric is sent successfully', async () => {
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(7);
        const payload = { Event: 'Valid Metric' };
        await expect(sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleLogSpy).toHaveBeenCalledWith('Sending anonymous metric', expect.stringContaining('"Solution":"solution-id"'));
        expect(consoleLogSpy).toHaveBeenCalledWith('Sending anonymous metric', expect.stringContaining('"Version":"solution-version"'));
        expect(consoleLogSpy).toHaveBeenCalledWith('Sending anonymous metric', expect.stringContaining('"UUID":"anonymous-uuid"'));
        expect(consoleLogSpy).toHaveBeenCalledWith('Sending anonymous metric', expect.stringContaining('"TimeStamp":'));
        expect(consoleLogSpy).toHaveBeenCalledWith('Sending anonymous metric', expect.stringContaining('"Data":{"Event":"Valid Metric"'));
        expect(consoleLogSpy).toHaveBeenCalledWith('Anonymous metric response: OK (200)');
    });

    test('Exception is logged but function still returns', async () => {
        mockedAxios.post.mockRejectedValue('Error');
        const metrics = require('../metrics');

        expect.assertions(2);
        const payload = { Event: 'Valid Metric' };
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
    });

    test('Payload validation - missing anonymous UUID', async () => {
        delete process.env.ANONYMOUS_DATA_UUID;

        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(3);
        const payload = { Event: 'Valid Metric' };
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Anonymous UUID was not supplied'));
    });

    test('Payload validation - solution ID', async () => {
        delete process.env.SOLUTION_ID;

        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(3);
        const payload = { Event: 'Valid Metric' };
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Solution ID was not supplied'));
    });

    test('Payload validation - solution version', async () => {
        delete process.env.SOLUTION_VERSION;

        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(3);
        const payload = { Event: 'Valid Metric' };
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Solution version was not supplied'));
    });

    test('Payload validation - data was not an object', async () => {
        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(3);
        const payload = 'test';
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Data was not an object'));
    });

    test('Payload validation - data was null', async () => {
        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(3);
        const payload = null;
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Data was not supplied'));
    });

    test('Payload validation - data was null', async () => {
        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(3);
        const payload = {};
        await expect(metrics.sendAnonymousMetric(payload)).resolves.not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending anonymous metric');
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Data was an empty object'));
    });

    test('Payload validation - Timestamp was not set', async () => {
        const metrics = require('../metrics');
        mockedAxios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

        expect.assertions(1);
        try {
            const payload = {
                Solution: 'id',
                Version: 'version',
                UUID: 'anonymous-id',
                Data: { Event: 'no-timestamp' }
            };
            await expect(metrics.validatePayload(payload)).resolves.not.toThrow();
        } catch (err) {
            expect(err.message).toBe('TimeStamp was not supplied')
        }
    });
});
