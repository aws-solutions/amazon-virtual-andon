// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct, CustomResource, Duration, Stack, ArnFormat } from '@aws-cdk/core';
import { Bucket, IBucket } from '@aws-cdk/aws-s3';
import { Function as LambdaFunction, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Effect, PolicyStatement, Role, ServicePrincipal, PolicyDocument, Policy } from '@aws-cdk/aws-iam';
import { addCfnSuppressRules, ISetupPutWebsiteConfigCustomResourceProps } from '../../../utils/utils';
import { CustomResourceActions, ICopyWebsiteRequestProps, ICustomResourceRequestProps, IPutWebsiteConfigRequestProps, ISolutionLifecycleRequestProps } from '../../../../solution-helper/lib/utils';

export interface SolutionHelperProps {
    readonly sourceCodeBucketName: string;
    readonly sourceCodeKeyPrefix: string;
    readonly sendAnonymousData: string;
    readonly solutionVersion: string;
    readonly solutionDisplayName: string;
    readonly solutionId: string;
    readonly loggingLevel: string;
}

/**
 * Construct that creates resources for managing the solution's lifecycle.
 * A Custom Resource Lambda function is created along with various CloudFormation Custom Resources
 */
export class SolutionHelper extends Construct {
    public readonly solutionHelperLambda: LambdaFunction;
    private readonly sourceCodeBucket: IBucket;
    private readonly sourceCodeKeyPrefix: string;
    private readonly sendAnonymousData: string;
    public readonly anonymousDataUUID: string;
    public readonly iotEndpointAddress: string;

    constructor(scope: Construct, id: string, props: SolutionHelperProps) {
        super(scope, id);

        this.sourceCodeBucket = Bucket.fromBucketName(this, 'sourceCodeBucket', props.sourceCodeBucketName);
        this.sourceCodeKeyPrefix = props.sourceCodeKeyPrefix;
        this.sendAnonymousData = props.sendAnonymousData;

        const generateSolutionConstantsRole = new Role(this, 'GenerateSolutionConstantsFunctionRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            path: '/',
            inlinePolicies: {
                'CloudWatchLogsPolicy': new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                        resources: [Stack.of(this).formatArn({ service: 'logs', resource: 'log-group', resourceName: '/aws/lambda/*', arnFormat: ArnFormat.COLON_RESOURCE_NAME })]
                    })]
                }),
                'IoTPolicy': new PolicyDocument({
                    statements: [new PolicyStatement({
                        actions: ['iot:DescribeEndpoint'],
                        effect: Effect.ALLOW,
                        resources: ['*']
                    })]
                })
            }
        });

        const generateSolutionConstantsLambda = new LambdaFunction(this, 'GenerateSolutionConstantsFunction', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'solution-helper/index.handler',
            timeout: Duration.seconds(60),
            description: `${props.solutionDisplayName} (${props.solutionVersion}): Generate Solution Constants`,
            code: Code.fromBucket(this.sourceCodeBucket, [props.sourceCodeKeyPrefix, 'solution-helper.zip'].join('/')),
            role: generateSolutionConstantsRole,
            environment: {
                LOGGING_LEVEL: props.loggingLevel
            }
        });

        addCfnSuppressRules(generateSolutionConstantsRole, [{ id: 'W11', reason: '* is required for the iot:DescribeEndpoint permission' }]);

        const generateSolutionConstantsProps: ICustomResourceRequestProps = {
            Action: CustomResourceActions.GENERATE_SOLUTION_CONSTANTS
        };

        const generateSolutionConstantsCustomResource = new CustomResource(this, 'GenerateSolutionConstants', {
            serviceToken: generateSolutionConstantsLambda.functionArn,
            properties: generateSolutionConstantsProps
        });

        this.anonymousDataUUID = generateSolutionConstantsCustomResource.getAttString('AnonymousDataUUID');
        this.iotEndpointAddress = generateSolutionConstantsCustomResource.getAttString('IotEndpointAddress');

        const solutionHelperLambdaRole = new Role(this, 'SolutionHelperFunctionRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            path: '/',
            inlinePolicies: {
                'CloudWatchLogsPolicy': new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                        resources: [Stack.of(this).formatArn({ service: 'logs', resource: 'log-group', resourceName: '/aws/lambda/*', arnFormat: ArnFormat.COLON_RESOURCE_NAME })]
                    })]
                })
            }
        });

        this.solutionHelperLambda = new LambdaFunction(this, 'SolutionHelperFunction', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'solution-helper/index.handler',
            timeout: Duration.seconds(60),
            description: `${props.solutionDisplayName} (${props.solutionVersion}): Solution Helper`,
            code: Code.fromBucket(this.sourceCodeBucket, [props.sourceCodeKeyPrefix, 'solution-helper.zip'].join('/')),
            role: solutionHelperLambdaRole,
            environment: {
                RETRY_SECONDS: '5',
                SEND_ANONYMOUS_DATA: this.sendAnonymousData,
                SOLUTION_ID: props.solutionId,
                SOLUTION_VERSION: props.solutionVersion,
                ANONYMOUS_DATA_UUID: this.anonymousDataUUID,
                LOGGING_LEVEL: props.loggingLevel
            }
        });
    }

    /**
     * Creates the CloudFormation Custom Resource that will stage the static assets for the Web UI in the hosting bucket
     * @param props ISetupCopyWebsiteCustomResourceProps: Properties about the Web UI hosting
     */
    public setupCopyWebsiteCustomResource(props: ISetupCopyWebsiteCustomResourceProps) {
        // Allows the custom resource to read the static assets for the Amplify front-end from the source code bucket
        this.sourceCodeBucket.grantRead(this.solutionHelperLambda, `${this.sourceCodeKeyPrefix}/*`);

        // Allows the custom resource to place the static assets for the Amplify front-end into the hosting bucket
        props.hostingBucket.grantPut(this.solutionHelperLambda);

        // Allows the custom resource to configure CORS for the website hosting bucket
        this.solutionHelperLambda.addToRolePolicy(new PolicyStatement({
            actions: ['s3:PutBucketCors'],
            effect: Effect.ALLOW,
            resources: [props.hostingBucket.bucketArn]
        }));

        const copyWebsiteCustomResourceProps: ICopyWebsiteRequestProps = {
            Action: CustomResourceActions.COPY_WEBSITE,
            SourceBucket: this.sourceCodeBucket.bucketName,
            SourceKey: `${this.sourceCodeKeyPrefix}/console`,
            SourceManifest: 'site-manifest.json',
            DestinationBucket: props.hostingBucket.bucketName,
            WebsiteDistributionDomain: `https://${props.hostingDomain}`
        };

        new CustomResource(this, 'CopyWebsite', {   // NOSONAR: typescript:S1848
            serviceToken: this.solutionHelperLambda.functionArn,
            properties: copyWebsiteCustomResourceProps
        });
    }

    /**
     * Creates the CloudFormation Custom Resource that will create the Amplify configuration object in the hosting bucket
     * @param props ISetupPutWebsiteConfigCustomResourceProps: Properties with resource identifiers to be used in the creation of the amplify configuration file
     */
    public setupPutWebsiteConfigCustomResource(props: ISetupPutWebsiteConfigCustomResourceProps) {
        const putWebsiteConfigCustomResourceProps: IPutWebsiteConfigRequestProps = {
            Action: props.customResourceAction,
            S3Bucket: props.hostingBucket.bucketName,
            AndonWebsiteConfigFileBaseName: props.andonWebsiteConfigFileName,
            AndonWebsiteConfig: props.andonWebsiteConfig
        };

        return new CustomResource(this, 'PutWebsiteConfig', {
            serviceToken: this.solutionHelperLambda.functionArn,
            properties: putWebsiteConfigCustomResourceProps
        });
    }

    /**
     * Creates a CloudFormation Custom Resource to be called during the solution lifecycle (Create/Update/Delete).
     * The IoT Policy Name is supplied so it can be detached when the solution is deleted
     * @param props ISetupDeleteStackCustomResourceProps: Property with the IoT Policy Name
     */
    public setupSolutionLifecycleCustomResource(props: ISetupDeleteStackCustomResourceProps) {
        this.solutionHelperLambda.addToRolePolicy(new PolicyStatement({
            actions: ['iot:ListTargetsForPolicy'],
            effect: Effect.ALLOW,
            resources: [Stack.of(this).formatArn({ service: 'iot', resource: 'policy', resourceName: '*', arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
        }));

        const iotPolicy = new Policy(this, 'CustomResourceLambdaIoTPolicy', {
            policyName: 'CustomResourceLambdaIoTPolicy',
            document: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: ['iot:DetachPrincipalPolicy'],
                        effect: Effect.ALLOW,
                        resources: ['*']
                    })
                ]
            })
        });

        addCfnSuppressRules(iotPolicy, [{ id: 'W12', reason: 'To connect IoT and attach IoT policy to Cognito identity cannot specify the specific resources.' }]);

        this.solutionHelperLambda.role!.attachInlinePolicy(iotPolicy);

        const solutionLifecycleCustomResourceProps: ISolutionLifecycleRequestProps = {
            Action: CustomResourceActions.SOLUTION_LIFECYCLE,
            IotPolicyName: props.iotPolicyName,
            SolutionParameters: {
                DefaultLanguage: props.defaultLanguage,
                LoggingLevel: props.loggingLevel,
                StartGlueWorkflow: props.startGlueWorkflow,
                AnomalyDetectionBucketParameterSet: props.anomalyDetectionBucketParameterSet,
                CognitoDomainPrefixParameterSet: props.cognitoDomainPrefixParameterSet,
                CognitoSAMLProviderMetadataUrlParameterSet: props.cognitoSAMLProviderMetadataUrlParameterSet,
                CognitoSAMLProviderNameParameterSet: props.cognitoSAMLProviderNameParameterSet
            }
        };

        new CustomResource(this, 'SolutionLifecycle', { // NOSONAR: typescript:S1848
            serviceToken: this.solutionHelperLambda.functionArn,
            properties: solutionLifecycleCustomResourceProps
        });
    }
}

interface ISetupCopyWebsiteCustomResourceProps {
    readonly hostingBucket: Bucket;
    readonly hostingDomain: string;
}

interface ISetupDeleteStackCustomResourceProps {
    readonly iotPolicyName: string;
    readonly defaultLanguage: string;
    readonly loggingLevel: string;
    readonly startGlueWorkflow: 'Yes' | 'No';
    readonly anomalyDetectionBucketParameterSet: 'Yes' | 'No';
    readonly cognitoDomainPrefixParameterSet: 'Yes' | 'No';
    readonly cognitoSAMLProviderMetadataUrlParameterSet: 'Yes' | 'No';
    readonly cognitoSAMLProviderNameParameterSet: 'Yes' | 'No';
}
