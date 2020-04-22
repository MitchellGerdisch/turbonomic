#!/bin/sh
msg="REPLACE MOVE VM; VM: ${VMT_TARGET_NAME}" 
echo `date` "${msg}" >> /tmp/output_actionscript.out
`pwd`/slack.sh "${msg}"
