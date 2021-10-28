# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2021-10-28
⚠ BREAKING CHANGES
Version 3.0.0 does not support upgrading from previous versions.
### Added
- Option to export the solution’s DynamoDB table data to Amazon S3 for in-depth data analysis
- Ability to enter nested “sub events” after creating events
- Edit option for closed issues for Root Cause and Comments
- Option to subscribe multiple email addresses and/or phone numbers to Events for Amazon SNS notifications
- Multi-language support: Thai

### Changed
- Architecture is now maintained using the AWS [Cloud Development Kit](https://aws.amazon.com/cdk/)
- Consolidated previous Metrics & History pages into the new Issue Reporting page
- Capture the users who create, acknowledge, and close issues so they can be viewed in the Issue Reporting screen

## [2.2.0] - 2021-07-07
### Added
- Added ability to upload images and associate them with events
- Added ability to add additional messages to root causes when closing issues
- Added ability for issues to be created in response to a JSON object being uploaded to an S3 bucket
- Added an option to view issues for all areas within a site in the Observer view
- Display relative time (i.e. created 5 minutes ago) when viewing an issue

### Changed
- Changed URL structure to allow bookmarking

### Fixed
- Fixed an issue when editing a user's permissions

## [2.1.2] - 2021-05-20
### Fixed
- Fixed AppSync subscription issue on the Client and Observer pages

## [2.1.1] - 2021-03-31
### Fixed
- Removed IoT rule from the CloudFormation template which blocked to deploy the stack
- Node.JS packages version to mitigate the security vulnerabilities

## [2.1.0] - 2020-08-31
### Added
- Multi-language support: German, English, Spanish, French, Japanese, Korean, and simplified Chinese

### Changed
- Users will not see choosing root cause pop-up when there is no attached root cause to the event when they close issues.

### Fixed
- Fix duplicated devices insertion at permission setting

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