#!/bin/sh

# USED TO KEEP SNOW INSTANCE AWAKE
# Change DEV_INSTANCE_ID_GOES_HERE and PASSWORD_GOES_HERE

response=`curl -s "https://DEV_INSTANCE_ID_GOES_HERE.service-now.com/api/now/table/x_turbo_turbonomic_turbonomic_settings?sysparm_limit=1" \
--request GET \
--header "Accept:application/json" \
--user 'admin':'PASSWORD_GOES_HERE'` 

now=`date`

echo "${now} RESPONSE: ${response}"