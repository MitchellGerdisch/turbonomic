# Lambda Python Script to update AWS creds in Turbonomic
# Assumes Lambda has a route to the Turbonomic instance.
# 
# Uses Lambda environment variables for the following inputs:
# turboinstance: DNS name or IP address for the turbo instance
# accountid: The AWS account ID for which the keys are being updated in Turbonomic
# accesskey: The new access key to use for the given AWS account target in Turbonomic
# secretaccesskey: The new secret access key to use for the given AWS account target in Turbonomic
#
# The lambda_handler can be modified to gather these parameters via other mechanisms and passed to the update_aws_target_cres() function.


import json
import os
from botocore.vendored import requests

def lambda_handler(event, context):
    # TODO implement
    turboinstance = os.environ['TURBOINSTANCE']
    turbouser = os.environ['TURBOUSER']
    turbopassword = os.environ['TURBOPASSWORD']
    accountid = os.environ['ACCOUNTID']
    accesskey = os.environ['ACCESSKEY']
    secretaccesskey = os.environ['SECRETACCESSKEY']

    result = update_aws_target_creds(turboinstance, turbouser, turbopassword, accountid, accesskey, secretaccesskey)
    return(result)
    
# This updates the AWS Account Target in Turbonomic using the Turbonomic REST API
def update_aws_target_creds(turboinstance, turbouser, turbopassword, accountid, accesskey, secretaccesskey):
    # Find the target AWS account's UUID - needed for the update action
    turbo_uri = "https://"+turboinstance+"/vmturbo/rest"
    headers = {'content-type': 'application/json'}
 
    response = requests.get(
    turbo_uri+"/search",
    headers=headers,
    auth=(turbouser, turbopassword),
    verify=False,
    timeout=15,
    params={'q': accountid, 'types':'BusinessAccount'}
    )

    # Get the given AWS account's Turbonomic UUID - needed for subsequent API call
    uuid = response.json()[0]['targets'][0]['uuid']


    # Update the target with the new keys
    update_response = requests.put(
    turbo_uri+"/targets/"+uuid,
    headers=headers,
    auth=(turbouser, turbopassword),
    verify=False,
    timeout=15,
    json={
        'category':'Cloud Management',
        'type':'AWS',
        'inputFields':[
            {
            'name':'username',
            'value':accesskey
            },
            {
            'name':'password',
            'value':secretaccesskey
            }
        ],
        'uuid':uuid
     })
    
    return(update_response.json())
    
#     {
#   "inputFields": [
#     {
#       "name": "username",
#       "value": "myaccesskey"
#     },
#     {
#       "name": "password",
#       "value": "mysecuret"
#     }
#   ],
#   "uuid": "_VrgWQKyKEemjrPHwhF4APg",
#   "type": "AWS",
#   "category": "Cloud Management"
# }



