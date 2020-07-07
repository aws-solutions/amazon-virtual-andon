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
SUB_BUCKET_NAME="s/BUCKET_NAME_PLACEHOLDER/$1/g"
SUB_SOLUTION_NAME="s/SOLUTION_NAME_PLACEHOLDER/$2/g"
SUB_VERSION="s/VERSION_PLACEHOLDER/$3/g"

for FULLNAME in ./*.yaml
do
  TEMPLATE=`basename $FULLNAME .yaml`
  echo "Template: $TEMPLATE"
  sed -e $SUB_BUCKET_NAME -e $SUB_SOLUTION_NAME -e $SUB_VERSION $template_dir/$TEMPLATE.yaml > $template_dist_dir/$TEMPLATE.template
  cp $template_dist_dir/$TEMPLATE.template $build_dist_dir/
done

echo "------------------------------------------------------------------------------"
echo "[Build] Amazon Virtual Andon Custom Resource"
echo "------------------------------------------------------------------------------"
cd $source_dir/custom-resource
npm run build
cp ./dist/ava-custom-resource.zip $build_dist_dir/ava-custom-resource.zip

echo "------------------------------------------------------------------------------"
echo "[Build] Amazon Virtual Andon Issue Handler"
echo "------------------------------------------------------------------------------"
cd $source_dir/ava-issue-handler
npm run build
cp ./dist/ava-issue-handler.zip $build_dist_dir/ava-issue-handler.zip

echo "------------------------------------------------------------------------------"
echo "[Build] Amazon Virtual Andon Migration"
echo "------------------------------------------------------------------------------"
cd $source_dir/migration
npm run build
cp ./dist/ava-migration.zip $build_dist_dir/ava-migration.zip

echo "------------------------------------------------------------------------------"
echo "[Build] Amazon Virtual Andon Console"
echo "------------------------------------------------------------------------------"
cd $source_dir/console
INLINE_RUNTIME_CHUNK=false npm run build
mkdir $build_dist_dir/console
cp -r ./build/* $build_dist_dir/console

echo "------------------------------------------------------------------------------"
echo "[Create] Console manifest"
echo "------------------------------------------------------------------------------"
cd $source_dir/console/build
manifest=(`find * -type f ! -iname "andon_config.js" ! -iname ".DS_Store"`)
manifest_json=$(IFS=,;printf "%s" "${manifest[*]}")
echo "{\"files\":[\"$manifest_json\"]}" | sed 's/,/","/g' >> $build_dist_dir/console/site-manifest.json

echo "------------------------------------------------------------------------------"
echo "[Copy] GraphQL resources"
echo "------------------------------------------------------------------------------"
cd $source_dir/graphql
mkdir $build_dist_dir/graphql
cp -r ./* $build_dist_dir/graphql