// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Structure of a record representing an object being uploaded to the S3 bucket
 */
export interface IS3Record {
    eventSource: string;
    eventName: string;
    s3: {
        bucket: { name: string; }
        object: { key: string; }
    }
}

/**
 * Structure of a request coming from an S3
 */
export interface IS3Request {
    Records: IS3Record[];
}

/**
 * Structure of a message sent to the IoT Devices topic
 */
export interface IIotMessage {
    messages: {
        name: string;
        timestamp: string;
        quality: string;
        value: string
    }[]
}

/**
 * Structure of the properties object used when publishing a new issue
 */
export interface IPublishIssueParams {
    eventId: string;
    eventDescription: string;
    priority: string;
    deviceName: string;
    stationName: string;
    areaName: string;
    siteName: string;
    processName: string;
    issueSource: 's3File' | 'device',
    createdBy: 'automatic-issue-detection' | 'device',
    additionalDetails?: string;
}
