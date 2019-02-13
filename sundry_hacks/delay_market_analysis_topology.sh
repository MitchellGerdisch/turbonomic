#!/bin/sh
#
# Modifies customer topology file to delay market analysis for 30 days.
# Topology file is located: srv/tomcat/data/repos/customer.markets.topology
#


if [ $# -ne 1 ]
then
	echo "USAGE: $0 <TOPOLOGY FILE>"
	echo ""
	echo "Modifies provided topology file to delay market analysis for 30 days."
	echo "See https://greencircle.vmturbo.com/docs/DOC-6091"
	exit 1
fi

TOPO_FILE=${1}
MODIFIED_FILE=${TOPO_FILE}.mkt_delay

# This M2_SUSPENSION_RERUN_INTERVAL entry is used to flag where to add the directive to delay market analysis as per the above referenced document.
grep 'M2_SUSPENSION_RERUN_INTERVAL="14400000"' ${TOPO_FILE} > /dev/null
if [ $? -ne 0 ]
then
	echo "No \'M2_SUSPENSION_RERUN_INTERVAL=\"14400000\"\' found in file"
	exit 1
fi
sed 's/M2_SUSPENSION_RERUN_INTERVAL="14400000"/M2_SUSPENSION_RERUN_INTERVAL="14400000" M2_ANALYSIS_RERUN_INTERVAL_MS="2592000000"/g' ${TOPO_FILE} > ${TOPO_FILE}.mkt_delay

echo "${MODIFIED_FILE} created with market analysis delay added."
