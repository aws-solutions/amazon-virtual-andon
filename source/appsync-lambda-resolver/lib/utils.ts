// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Structure of a request coming from an AppSync resolver
 */
export interface IAppSyncResolverRequest {
    arguments: {
        previousSms: string;
        previousEmail: string;
    };
    identity: any;
    request: any;
    prev?: {
        result: any
    };
    info: {
        parentTypeName: string;
        fieldName: string;
    };
}

/**
 * Structure of a subscription to the solution's SNS topic
 */
export interface IAvaTopicSubscription {
    protocol: SubscriptionProtocols;
    endpoint: string;
    subscriptionArn?: string;
    filterPolicy?: IAvaSnsFilterPolicy;
}

/**
 * Structure of the SNS Filter Policy that will be applied when creating
 * subscriptions to the solution's SNS topic
 */
export interface IAvaSnsFilterPolicy {
    eventId: string[];
}

/**
 * Available SNS subscription protocols
 */
export enum SubscriptionProtocols {
    EMAIL = 'email',
    SMS = 'sms'
}

/**
 * The AppSync mutation fields that can be supported by this Lambda resolver
 */
export enum SupportedMutationFieldNames {
    CREATE_EVENT = 'createEvent',
    UPDATE_EVENT = 'updateEvent',
    DELETE_EVENT = 'deleteEvent'
}

/**
 * The AppSync query fields that can be supported by this Lambda resolver
 */
export enum SupportedQueryFieldNames {
    GET_PREV_DAY_ISSUES_STATS = 'getPrevDayIssuesStats'
}

/**
 * The AppSync parent types that can be supported by this Lambda resolver
 */
export enum SupportedParentTypeNames {
    MUTATION = 'Mutation',
    QUERY = 'Query'
}

/**
 * Structure for the output of the `getPrevDayIssuesStats` Query
 */
export interface IGetPrevDayIssuesStatsOutput {
    open: number;
    acknowledged: number;
    closed: number;
    lastThreeHours: number;
}