#!/bin/sh
basedir=$(dirname $0)
msg="REPLACE RESIZE VM; VM: ${VMT_TARGET_NAME}" 
echo `date` "${msg}" >> /tmp/output_actionscript.out
${basedir}/slack.sh "${msg}"
