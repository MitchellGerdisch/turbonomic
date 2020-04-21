#!/bin/sh
msg="REPLACE RESIZE VM; VM: ${VMT_TARGET_NAME}" 
echo `date` "${msg}" >> /tmp/output_actionscript.out
/home/ec2-user/action_scripts/slack.sh "${msg}"
