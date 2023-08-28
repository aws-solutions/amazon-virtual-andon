// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserPool, CfnUserPool, UserPoolClient, CfnUserPoolClient, CfnIdentityPool, CfnIdentityPoolRoleAttachment, CfnUserPoolGroup, CfnUserPoolUser, CfnUserPoolUserToGroupAttachment, UserPoolDomain, CfnUserPoolIdentityProvider, OAuthScope } from 'aws-cdk-lib/aws-cognito';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { addCfnSuppressRules, IotConstants, ISetupPutWebsiteConfigCustomResourceProps } from '../../utils/utils';
import { buildUserPool, buildUserPoolClient, buildIdentityPool } from '@aws-solutions-constructs/core';
import { IPutWebsiteConfigRequestProps } from '../../../solution-helper/lib/utils';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { Bucket, BucketAccessControl, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Effect, FederatedPrincipal, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { ArnFormat, Aws, CfnCondition, CfnOutput, CfnParameter, CfnResource, CustomResource, Duration, Fn, Stack } from 'aws-cdk-lib';
import { CfnPermission, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';

export interface IFrontEndProps {
    readonly sourceCodeBucketName: string;
    readonly sourceCodeKeyPrefix: string;
    readonly administratorEmail: string;
    readonly solutionDisplayName: string;
    readonly sendAnonymousData: string;
    readonly anonymousDataUUID: string;
    readonly solutionVersion: string;
    readonly solutionId: string;
    readonly loggingLevel: string;
}

/**
 * Construct that creates the front-end resources for the solution. A CloudFront Distribution, S3 bucket,
 * and Cognito resources will be created
 */
export class FrontEnd extends Construct {
    public readonly websiteDistribution: Distribution;
    public readonly websiteHostingBucket: Bucket;
    public readonly userPool: UserPool;
    public readonly userPoolClient: UserPoolClient;
    public readonly identityPool: CfnIdentityPool;
    public readonly identityPoolRole: Role;
    public readonly cognitoDomainPrefixParameter: CfnParameter;
    public readonly samlProviderNameParameter: CfnParameter;
    public readonly samlProviderMetadataUrlParameter: CfnParameter;
    private readonly userPoolDomain: UserPoolDomain;
    private readonly cognitoSAMLCondition: CfnCondition;

    constructor(scope: Construct, id: string, props: IFrontEndProps) {
        super(scope, id);

        const sourceCodeBucket = Bucket.fromBucketName(this, 'sourceCodeBucket', props.sourceCodeBucketName);

        const cloudFrontToS3 = new CloudFrontToS3(this, 'DistributionToS3', {
            bucketProps: {
                versioned: true,
                encryption: BucketEncryption.S3_MANAGED,
                accessControl: BucketAccessControl.PRIVATE,
                enforceSSL: true,
                autoDeleteObjects: false
            },
            cloudFrontDistributionProps: {
                comment: 'Website Distribution for Amazon Virtual Andon',
                enableLogging: true,
                logFilePrefix: 'hosting-cloudfront/',
                errorResponses: [
                    { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
                    { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }
                ]
            },
            insertHttpSecurityHeaders: false
        });
        this.websiteDistribution = cloudFrontToS3.cloudFrontWebDistribution;
        this.websiteHostingBucket = cloudFrontToS3.s3Bucket!;

        NagSuppressions.addResourceSuppressions(
            cloudFrontToS3,
            [
                {
                    id: "AwsSolutions-S1",
                    reason: "The bucket doesn't have server access logs enabled because it is a logging bucket itself"
                },
                { id: "AwsSolutions-CFR1", reason: "The solution does not control geo restriction." },
                { id: "AwsSolutions-CFR2", reason: "No need to enable WAF." },
                {
                    id: "AwsSolutions-CFR4",
                    reason: "No control on the solution side as it is using the CloudFront default certificate."
                }
            ],
            true
        );

        this.userPool = buildUserPool(this, {
            userPoolName: 'ava-userpool',
            userInvitation: {
                emailSubject: `[${props.solutionDisplayName}] - Login Information`,
                emailBody: `<p>
                        You are invited to join Amazon Virtual Andon. Your temporary password is as follows:
                    </p>
                    <p>
                        E-Mail: <strong>{username}</strong><br />
                        Password: <strong>{####}</strong>
                    </p>
                    <p>
                        Please sign in to Amazon Virtual Andon with your Username (E-Mail) and temporary password provided above at:<br />
                        https://${this.websiteDistribution.domainName}
                    </p>`
            },
            passwordPolicy: {
                minLength: 8,
                requireDigits: true,
                requireLowercase: true,
                requireSymbols: true,
                requireUppercase: true,
                tempPasswordValidity: Duration.days(7)
            },
            selfSignUpEnabled: false
        });

        NagSuppressions.addResourceSuppressions(
            this.userPool,
            [
                {
                    id: "AwsSolutions-COG2",
                    reason: "MFA not required for this version of the solution"
                }
            ],
            true
        );

        this.userPoolClient = buildUserPoolClient(this, this.userPool, {
            userPool: this.userPool,
            userPoolClientName: 'ava-userpool-client',
            refreshTokenValidity: Duration.days(1),
            generateSecret: false,
            preventUserExistenceErrors: true,
            oAuth: {
                callbackUrls: [`https://${this.websiteDistribution.domainName}/`],
                logoutUrls: [`https://${this.websiteDistribution.domainName}/`],
                flows: { authorizationCodeGrant: true, implicitCodeGrant: false, clientCredentials: false },
                scopes: [OAuthScope.PHONE, OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN]
            }
        });

        const adminGroup = new CfnUserPoolGroup(this, 'UserPoolAdminGroup', {
            userPoolId: this.userPool.userPoolId,
            description: 'Admin group for Amazon Virtual Andon',
            groupName: 'AdminGroup',
            precedence: 0
        });

        new CfnUserPoolGroup(this, 'UserPoolManagerGroup', {    // NOSONAR: typescript:S1848
            userPoolId: this.userPool.userPoolId,
            description: 'Manager group for Amazon Virtual Andon',
            groupName: 'ManagerGroup',
            precedence: 1
        });

        new CfnUserPoolGroup(this, 'UserPoolAssociateGroup', {  // NOSONAR: typescript:S1848
            userPoolId: this.userPool.userPoolId,
            description: 'Associate group for Amazon Virtual Andon',
            groupName: 'AssociateGroup',
            precedence: 2
        });

        new CfnUserPoolGroup(this, 'UserPoolEngineerGroup', {   // NOSONAR: typescript:S1848
            userPoolId: this.userPool.userPoolId,
            description: 'Engineer group for Amazon Virtual Andon',
            groupName: 'EngineerGroup',
            precedence: 3
        });

        const adminUser = new CfnUserPoolUser(this, 'AdminUser', {
            userPoolId: this.userPool.userPoolId,
            username: props.administratorEmail,
            desiredDeliveryMediums: ['EMAIL'],
            forceAliasCreation: true,
            userAttributes: [
                { name: 'email', value: props.administratorEmail },
                { name: 'email_verified', value: 'true' }
            ]
        });

        new CfnUserPoolUserToGroupAttachment(this, 'AdminGroupAssignment', {    // NOSONAR: typescript:S1848
            userPoolId: this.userPool.userPoolId,
            username: adminUser.ref,
            groupName: adminGroup.ref
        });

        this.identityPool = buildIdentityPool(this, this.userPool, this.userPoolClient);

        this.identityPoolRole = new Role(this, 'IdentityPoolRole', {
            assumedBy: new FederatedPrincipal('cognito-identity.amazonaws.com', {
                'StringEquals': { 'cognito-identity.amazonaws.com:aud': this.identityPool.ref },
                'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
            }, 'sts:AssumeRoleWithWebIdentity'),
            description: `Identity Pool Authenticated Role for ${props.solutionDisplayName}`
        });

        const avaIotPolicy = new Policy(this, 'AVAIotPolicy', {
            policyName: 'AVAIotPolicy',
            document: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: [
                            'iot:AttachPrincipalPolicy',
                            'iot:Connect'
                        ],
                        effect: Effect.ALLOW,
                        resources: ['*']
                    }),
                    new PolicyStatement({
                        actions: ['iot:Publish'],
                        effect: Effect.ALLOW,
                        resources: [
                            Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: IotConstants.ISSUES_TOPIC, arnFormat: ArnFormat.SLASH_RESOURCE_NAME }),
                            Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: `${IotConstants.GROUPS_TOPIC}/*`, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })
                        ]
                    }),
                    new PolicyStatement({
                        actions: ['iot:Subscribe'],
                        effect: Effect.ALLOW,
                        resources: [Stack.of(this).formatArn({ service: 'iot', resource: 'topicfilter', resourceName: `${IotConstants.GROUPS_TOPIC}/*`, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
                    }),
                    new PolicyStatement({
                        actions: ['iot:Receive'],
                        effect: Effect.ALLOW,
                        resources: [Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: `${IotConstants.GROUPS_TOPIC}/*`, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
                    })
                ]
            })
        });

        addCfnSuppressRules(avaIotPolicy, [{ id: 'W12', reason: 'To connect IoT and attach IoT policy to Cognito identity cannot specify the specific resources.' }]);

        NagSuppressions.addResourceSuppressions(
            avaIotPolicy,
            [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "To connect IoT and attach IoT policy to Cognito identity cannot specify the specific resources."
                }
            ],
            true
        );

        this.identityPoolRole.attachInlinePolicy(avaIotPolicy);

        this.identityPoolRole.attachInlinePolicy(new Policy(this, 'AVACognitoPolicy', {
            policyName: 'AVACognitoPolicy',
            document: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: [
                            'cognito-idp:ListUsers',
                            'cognito-idp:ListUsersInGroup',
                            'cognito-idp:AdminGetUser',
                            'cognito-idp:AdminListGroupsForUser',
                            'cognito-idp:AdminCreateUser',
                            'cognito-idp:AdminDeleteUser',
                            'cognito-idp:AdminAddUserToGroup',
                            'cognito-idp:AdminRemoveUserFromGroup'
                        ],
                        effect: Effect.ALLOW,
                        resources: [this.userPool.userPoolArn]
                    })
                ]
            })
        }));


        const avaEventImagePolicy = new Policy(this, 'AVAEventImagePolicy', {
            policyName: 'AVAEventImagePolicy',
            document: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: [
                            's3:GetObject',
                            's3:PutObject',
                            's3:DeleteObject'
                        ],
                        effect: Effect.ALLOW,
                        resources: [`${this.websiteHostingBucket.bucketArn}/public/event-images/*`]
                    })
                ]
            })
        })
        this.identityPoolRole.attachInlinePolicy(avaEventImagePolicy);

        NagSuppressions.addResourceSuppressions(
            avaEventImagePolicy,
            [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Identity pool needs access to all resources under specific key path folder in website hosting bucket"
                }
            ],
            true
        );

        this.identityPoolRole.attachInlinePolicy(new Policy(this, 'AVAListEventImagePolicy', {
            policyName: 'AVAListEventImagePolicy',
            document: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: [
                            's3:ListBucket'
                        ],
                        effect: Effect.ALLOW,
                        resources: [this.websiteHostingBucket.bucketArn]
                    })
                ]
            })
        }));

        new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', { // NOSONAR: typescript:S1848
            identityPoolId: this.identityPool.ref,
            roles: { authenticated: this.identityPoolRole.roleArn }
        });

        // Cognito domain would be used in the case of enabling 3rd party federation on the
        // user pool
        this.cognitoDomainPrefixParameter = new CfnParameter(this, 'CognitoDomainPrefixParameter', {
            description: '(Optional) The prefix to the Cognito hosted domain name that will be associated with the user pool.',
            default: '',
            allowedPattern: '^$|^[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?$'
        });
        this.cognitoDomainPrefixParameter.overrideLogicalId('CognitoDomainPrefixParameter');

        const cognitoDomainPrefixCondition = new CfnCondition(this, 'CognitoDomainPrefixCondition', {
            expression: Fn.conditionNot(Fn.conditionEquals(this.cognitoDomainPrefixParameter.valueAsString, ''))
        });

        this.userPoolDomain = new UserPoolDomain(this, 'UserPoolDomain', {
            userPool: this.userPool,
            cognitoDomain: { domainPrefix: this.cognitoDomainPrefixParameter.valueAsString }
        });
        (this.userPoolDomain.node.defaultChild as CfnResource).cfnOptions.condition = cognitoDomainPrefixCondition;

        const domainNameCfnOutput = new CfnOutput(this, 'CognitoDomain', {
            description: 'Cognito hosted domain',
            value: `https://${this.userPoolDomain.domainName}.auth.${Aws.REGION}.amazoncognito.com`
        });
        domainNameCfnOutput.condition = cognitoDomainPrefixCondition;
        domainNameCfnOutput.overrideLogicalId('CognitoDomain');

        const userPoolIdCfnOutput = new CfnOutput(this, 'UserPoolId', {
            description: 'Cognito User Pool ID',
            value: this.userPool.userPoolId
        });
        userPoolIdCfnOutput.condition = cognitoDomainPrefixCondition;
        userPoolIdCfnOutput.overrideLogicalId('UserPoolId');

        // Set up SAML Identity Provider
        this.samlProviderNameParameter = new CfnParameter(this, 'CognitoSAMLProviderNameParameter', {
            description: '(Optional) The identity provider name.',
            default: '',
            allowedPattern: '^[a-zA-Z]*$',
            maxLength: 32
        });
        this.samlProviderNameParameter.overrideLogicalId('CognitoSAMLProviderNameParameter');

        this.samlProviderMetadataUrlParameter = new CfnParameter(this, 'CognitoSAMLProviderMetadataUrlParameter', {
            description: '(Optional) MetadataURL for the identity provider details.',
            default: ''
        });
        this.samlProviderMetadataUrlParameter.overrideLogicalId('CognitoSAMLProviderMetadataUrlParameter');

        this.cognitoSAMLCondition = new CfnCondition(this, 'CognitoSAMLCondition', {
            expression: Fn.conditionAnd(
                Fn.conditionNot(Fn.conditionEquals(this.samlProviderNameParameter.valueAsString, '')),
                Fn.conditionNot(Fn.conditionEquals(this.samlProviderMetadataUrlParameter.valueAsString, ''))
            )
        });

        const samlIdp = new CfnUserPoolIdentityProvider(this, 'CognitoSAMLProvider', {
            userPoolId: this.userPool.userPoolId,
            providerName: this.samlProviderNameParameter.valueAsString,
            providerType: 'SAML',
            providerDetails: { MetadataURL: this.samlProviderMetadataUrlParameter.valueAsString },
            attributeMapping: {
                'given_name': 'firstName',
                'family_name': 'lastName',
                'email': 'email'
            }
        });
        samlIdp.cfnOptions.condition = this.cognitoSAMLCondition;

        // If the SAML Identity Provider has been created, add it to the list of supported IDPs for the User Pool Client
        // otherwise, leave the default (COGNITO)
        (this.userPoolClient.node.defaultChild as CfnUserPoolClient)
            .supportedIdentityProviders = (Fn.conditionIf(
                this.cognitoSAMLCondition.logicalId,
                ['COGNITO', samlIdp.providerName],
                ['COGNITO']
            ) as unknown) as string[];

        // Create a Lambda function and configure a Cognito trigger on the user pool to allow for custom
        // actions to be performed on federated users
        const cognitoTriggerFunctionRole = new Role(this, 'CognitoTriggerFunctionRole', {
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

        NagSuppressions.addResourceSuppressions(
          cognitoTriggerFunctionRole,
          [
              {
                  id: "AwsSolutions-IAM5",
                  reason: "Cloudwatch logs policy needs access to all logs arns because it's creating log groups"
              }
          ],
          true
        );

        const cognitoTriggerLambda = new Function(this, 'CognitoTriggerFunction', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'cognito-trigger/index.handler',
            timeout: Duration.seconds(60),
            description: `${props.solutionDisplayName} (${props.solutionVersion}): Cognito Trigger. Used when a new user is confirmed in the user pool to allow for custom actions to be taken`,
            code: Code.fromBucket(sourceCodeBucket, [props.sourceCodeKeyPrefix, 'cognito-trigger.zip'].join('/')),
            role: cognitoTriggerFunctionRole,
            environment: {
                LOGGING_LEVEL: props.loggingLevel
            }
        });

        new CfnPermission(this, 'CognitoTriggerFunctionPermission', {
            action: 'lambda:InvokeFunction',
            principal: 'cognito-idp.amazonaws.com',
            functionName: cognitoTriggerLambda.functionName,
            sourceArn: this.userPool.userPoolArn,
        }).cfnOptions.condition = this.cognitoSAMLCondition;

        (cognitoTriggerFunctionRole.node.defaultChild as CfnResource).cfnOptions.condition = this.cognitoSAMLCondition;
        (cognitoTriggerLambda.node.defaultChild as CfnResource).cfnOptions.condition = this.cognitoSAMLCondition;
        (this.userPool.node.defaultChild as CfnUserPool)
            .lambdaConfig = (Fn.conditionIf(
                this.cognitoSAMLCondition.logicalId,
                { PostConfirmation: cognitoTriggerLambda.functionArn },
                {}
            ) as unknown) as any;
    }

    /**
     * Creates the CloudFormation Custom Resource that will create the Amplify configuration object in the hosting bucket
     * and also include the settings for OAuth
     * @param props ISetupPutWebsiteConfigCustomResourceProps: Properties with resource identifiers to be used in the creation of the amplify configuration file
     */
    public setupPutWebsiteWithOAuthConfigCustomResource(putWebsiteConfigCustomResource: CustomResource, solutionHelperFunctionArn: string, props: ISetupPutWebsiteConfigCustomResourceProps) {
        const putWebsiteConfigCustomResourceProps: IPutWebsiteConfigRequestProps = {
            Action: props.customResourceAction,
            S3Bucket: props.hostingBucket.bucketName,
            AndonWebsiteConfigFileBaseName: props.andonWebsiteConfigFileName,
            AndonWebsiteConfig: {
                ...props.andonWebsiteConfig,
                oauth: {
                    domain: `${this.userPoolDomain.domainName}.auth.${Aws.REGION}.amazoncognito.com`,
                    responseType: 'code',
                    scope: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
                    redirectSignIn: `https://${this.websiteDistribution.domainName}/`,
                    redirectSignOut: `https://${this.websiteDistribution.domainName}/`,
                }
            }
        };

        const customResource = new CustomResource(this, 'PutWebsiteConfigWithOAuth', {
            serviceToken: solutionHelperFunctionArn,
            properties: putWebsiteConfigCustomResourceProps
        });

        (customResource.node.defaultChild as CfnResource).cfnOptions.condition = this.cognitoSAMLCondition;
        (customResource.node.defaultChild as CfnResource).addDependency(putWebsiteConfigCustomResource.node.defaultChild as CfnResource);
    }
}
