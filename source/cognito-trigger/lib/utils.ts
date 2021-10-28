// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Structure of Cognito input to this function
 */
export interface IHandlerInput {
    userPoolId: string;
    userName: string;
    triggerSource: string;
    request: {
        userAttributes: {
            sub: string;
            email_verified: string;
            'cognito:user_status': string;
            identities: string;
        }
    }
}

export enum CognitoTriggerSource {
    POST_CONFIRM = 'PostConfirmation_ConfirmSignUp'
}

export enum CognitoUserStatus {
    EXTERNAL_PROVIDER = 'EXTERNAL_PROVIDER'
}