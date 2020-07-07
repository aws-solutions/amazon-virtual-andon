#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

# Get reference for all important folders
template_dir="$PWD"
source_dir="$template_dir/../source"

echo "1) Testing custom resource"
cd $source_dir/custom-resource
npm test

echo "2) Testing issue handler"
cd $source_dir/ava-issue-hanlder
npm test

echo "3) Testing migration"
cd $source_dir/migration
npm test