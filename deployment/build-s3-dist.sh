#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name trademarked-solution-name version-code
#
# Paramenters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#
#  - trademarked-solution-name: name of the solution for consistency
#
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

# Get reference for all important folders
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist folders"
echo "------------------------------------------------------------------------------"
echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir

echo "------------------------------------------------------------------------------"
echo "[Packing] Templates"
echo "------------------------------------------------------------------------------"
echo "cp $template_dir/amazon-virtual-andon.yaml $template_dist_dir/amazon-virtual-andon.template"
cp $template_dir/amazon-virtual-andon.yaml $template_dist_dir/amazon-virtual-andon.template

echo "Updating code source bucket in template with $1"
replace="s/%%BUCKET_NAME%%/$1/g"
echo "sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template"
sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template
replace="s/%%GITHUB_BUCKET_NAME%%/$2/g"
echo "sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template"
sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template
replace="s/%%SOLUTION_NAME%%/$3/g"
echo "sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template"
sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template
replace="s/%%VERSION%%/$4/g"
echo "sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template"
sed -i '' -e $replace $template_dist_dir/amazon-virtual-andon.template

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - Logger"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/logger
npm run build

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - Metrics"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/usage-metrics
npm run build

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Resources - CICD Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/cicd
npm run build
cp ./dist/ava-cicd.zip $build_dist_dir/ava-cicd.zip

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Services - AVA Issue Handler"
echo "------------------------------------------------------------------------------"
cd $source_dir/services/ava-issue-handler
npm run build
cp ./dist/ava-issue-handler.zip $build_dist_dir/ava-issue-handler.zip

