// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

/**
 * The actions this custom resource handler can support
 */
export enum CustomResourceActions {
    GENERATE_SOLUTION_CONSTANTS = 'GENERATE_SOLUTION_CONSTANTS',
    COPY_WEBSITE = 'COPY_WEBSITE',
    PUT_WEBSITE_CONFIG = 'PUT_WEBSITE_CONFIG',
    SOLUTION_LIFECYCLE = 'SOLUTION_LIFECYCLE',
    CONFIGURE_BUCKET_NOTIFICATION = 'CONFIGURE_BUCKET_NOTIFICATION'
}

/**
 * The CloudFormation lifecycle type for this custom resource
 */
export enum CustomResourceRequestTypes {
    CREATE = 'Create',
    UPDATE = 'Update',
    DELETE = 'Delete'
}

/**
 * Possible return values to the CloudFormation custom resource request.
 */
export enum StatusTypes {
    Success = 'SUCCESS',
    Failed = 'FAILED'
}

/**
 * Base interface for custom resource request properties
 * Action is required
 */
export interface ICustomResourceRequestProps {
    Action: CustomResourceActions;
}

/**
 * Request properties for the COPY_WEBSITE Custom Resource
 */
export interface ICopyWebsiteRequestProps extends ICustomResourceRequestProps {
    SourceBucket: string;
    SourceKey: string;
    SourceManifest: string;
    DestinationBucket: string;
    WebsiteDistributionDomain: string;
}

/**
 * Request properties for the SOLUTION_LIFECYCLE Custom Resource
 */
export interface ISolutionLifecycleRequestProps extends ICustomResourceRequestProps {
    IotPolicyName: string;
    SolutionParameters: {
        DefaultLanguage: string;
        StartGlueWorkflow: string;
        LoggingLevel: string;
        AnomalyDetectionBucketParameterSet: string;
        CognitoDomainPrefixParameterSet: string;
        CognitoSAMLProviderMetadataUrlParameterSet: string;
        CognitoSAMLProviderNameParameterSet: string;
    }
}

/**
 * Request properties for the PUT_WEBSITE_CONFIG Custom Resource
 */
export interface IPutWebsiteConfigRequestProps extends ICustomResourceRequestProps {
    S3Bucket: string;
    AndonWebsiteConfigFileBaseName: string;
    AndonWebsiteConfig: IAndonWebsiteConfig;
}

/**
 * Structure of the Amplify configuration object for the Amazon Virtual Andon web console
 */
export interface IAndonWebsiteConfig {
    aws_project_region: string;
    aws_cognito_identity_pool_id: string;
    aws_cognito_region: string;
    aws_user_pools_id: string;
    aws_user_pools_web_client_id: string;
    aws_appsync_graphqlEndpoint: string;
    aws_appsync_region: string;
    aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS';
    aws_iot_endpoint: string;
    aws_iot_policy_name: string;
    solutions_send_metrics: string;
    solutions_metrics_endpoint: 'https://metrics.awssolutionsbuilder.com/page';
    solutions_solutionId: string;
    solutions_solutionUuId: string;
    solutions_version: string;
    default_language: string;
    website_bucket: string;
    oauth?: {
        domain: string;
        scope: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'];
        redirectSignIn: string;
        redirectSignOut: string;
        responseType: 'code';
    };
}

/**
 * Request properties for the CONFIGURE_BUCKET_NOTIFICATION Custom Resource
 */
export interface IConfigureBucketNotificationRequestProps extends ICustomResourceRequestProps {
    BucketName: string;
    FunctionArn: string;
}

/**
 * The request object coming from CloudFormation
 */
export interface ICustomResourceRequest {
    RequestType: CustomResourceRequestTypes;
    PhysicalResourceId: string;
    StackId: string;
    ServiceToken: string;
    RequestId: string;
    LogicalResourceId: string;
    ResponseURL: string;
    ResourceType: string;
    ResourceProperties: ICustomResourceRequestProps | ICopyWebsiteRequestProps | IPutWebsiteConfigRequestProps | ISolutionLifecycleRequestProps | IConfigureBucketNotificationRequestProps;
}

/**
 * Returned from custom resource handler methods representing both the Status
 * and any corresponding data to include in the response.
 */
export interface ICompletionStatus {
    Status: StatusTypes
    Data: any
}

/**
 * The Lambda function context
 */
export interface ILambdaContext {
    getRemainingTimeInMillis: Function;
    functionName: string;
    functionVersion: string;
    invokedFunctionArn: string;
    memoryLimitInMB: number;
    awsRequestId: string;
    logGroupName: string;
    logStreamName: string;
    identity: any;
    clientContext: any;
    callbackWaitsForEmptyEventLoop: boolean;
}
