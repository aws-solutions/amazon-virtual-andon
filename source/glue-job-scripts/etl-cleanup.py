# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import boto3
import sys
from botocore import config
from datetime import datetime
from itertools import islice
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

# System arguments
args_list = ["glue_output_bucket", "glue_output_s3_key_prefix", "solution_id", "solution_version"]
args = getResolvedOptions(sys.argv, args_list) # NOSONAR: python:S4823
GLUE_OUTPUT_BUCKET = args["glue_output_bucket"]
GLUE_OUTPUT_S3_KEY_PREFIX = args["glue_output_s3_key_prefix"]
SOLUTION_ID = args["solution_id"]
SOLUTION_VERSION = args["solution_version"]

# Sets Glue context and logging
spark_context = SparkContext()
glue_context = GlueContext(spark_context)
job = Job(glue_context)

# AWS Clients
config_json = {}
if SOLUTION_ID.strip() != "" and SOLUTION_VERSION.strip() != "":
    config_json["user_agent_extra"] = f"AwsSolution/{SOLUTION_ID}/{SOLUTION_VERSION}"

config = config.Config(**config_json)
s3 = boto3.client('s3', config=config)

class DataCleanupException(Exception):
    """Raised when there is an issue while cleaning previous data from S3"""
    pass

def log_message(msg):
    msg_arr = [f'****** LOG_MSG {datetime.now()} ******']

    if not isinstance(msg, list): 
        msg = [msg]

    # Add some preceding whitespace to each line for the log message.
    # This makes it easier to read in the Glue logs on Cloudwatch
    msg = list(map(lambda x: f'     {x}', msg))

    msg_arr.extend(msg)
    msg_arr.append('')  # empty line

    # Glue sends Python logging messages (using logger) to the error logs in CloudWatch.
    # Instead, we will use the print statement as they appear in the normal Logs section
    # of the Glue job.
    print('\n'.join(msg_arr))        

def main():
    """
    Deletes any previous data that was exported from DynamoDB to S3 so
    the current ETL job will represent the current state of the DynamoDB tables
    """
    log_message(f"Looking for previously generated output files: s3://{GLUE_OUTPUT_BUCKET}/{GLUE_OUTPUT_S3_KEY_PREFIX}")

    list_params = {
        "Bucket": GLUE_OUTPUT_BUCKET,
        "Prefix": GLUE_OUTPUT_S3_KEY_PREFIX
    }

    previous_job_output_data = set()

    while True:
        response = s3.list_objects_v2(**list_params)
        if response["KeyCount"] > 0:
            # Extract only a list of Keys from the Contents returned by S3
            previous_job_output_data.update(list(map(lambda x: x["Key"], response["Contents"])))

        if "NextContinuationToken" not in response:
            # Exit the `while` loop if there are no more objects in the S3 bucket
            break
        else:
            # Search again if there are more items in the S3 bucket
            list_params["ContinuationToken"] = response["NextContinuationToken"]

    log_message(f"Number of previously generated output files: {len(previous_job_output_data)}")

    while len(previous_job_output_data) > 0:
        # Delete up to 500 objects at a time until the list of previously
        # generated output files is empty
        objects_to_delete = list(islice(previous_job_output_data, 500))

        log_message(f"Attempting to delete batch of previously generated data. Number of objects to delete: {len(objects_to_delete)}")

        delete_params = {
            "Bucket": GLUE_OUTPUT_BUCKET,
            "Delete": {
                "Objects": list(map(lambda x: { "Key": x }, objects_to_delete))
            }
        }

        delete_response = s3.delete_objects(**delete_params)

        if "Errors" in delete_response and len(delete_response["Errors"]) > 0:
            raise DataCleanupException(f"Error while cleaning previous job output: {str(delete_response['Errors'][0])}")

        if "Deleted" not in delete_response or len(delete_response["Deleted"]) != len(objects_to_delete):
            raise DataCleanupException(f"Error while cleaning previous job output. Expecting {len(objects_to_delete)} to be deleted but S3 reported {len(delete_response['Deleted'])} were deleted")

        # Remove the objects that were deleted from the 'previous_job_output_data' set
        previous_job_output_data = (previous_job_output_data - set(objects_to_delete))
        log_message(f"Successfully deleted {len(objects_to_delete)} objects. Number still left to delete: {len(previous_job_output_data)}")

    job.commit()

if __name__ == '__main__':
    main()