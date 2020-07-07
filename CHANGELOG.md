# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.0.0] - 2020-07-07
### Added
- Breadcrumb on every UI page
- Whole resources into the AWS CloudFormation template
- Unit tests for Lambda functions
- User management by administrator
- Permission management for associate group users
- Cache selection at Client page
- Hierarchy data deletion
- Amazon SNS topic deletion when an event is deleted.
- Data validation on AppSync resolver
- Root cause management by admin group users
- Root cause submission by engineer group users

### Changed
- Update bootstrap version from 3 to 4
- TypeScript is the main programming language for UI.
- Directory path for source code
- Revise the custom resource
- Rejected issues will have 0 resolution time.
- Prevent creating same name data (e.g. same site name, same area name under the same site, and so on)

### Removed
- The material dashboard template
- AWS Amplify CLI

## [1.0.1] - 2020-01-20
### Changed
- CodeBuild image to aws/codebuild/standard:3.0
- Amplify CLI to v4.12.0
- IAM permissions for AndonAmplifyPolicy

## [1.0.0] - 2019-11-04
### Added
- Solution initial version