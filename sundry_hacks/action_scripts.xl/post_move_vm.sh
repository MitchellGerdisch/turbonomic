#!/bin/sh
basedir=$(dirname $0)
msg="POST MOVE VM; VM: ${VMT_TARGET_NAME}" 
echo `date` "${msg}" >> /tmp/output_actionscript.out
${basedir}/slack.sh "${msg}"