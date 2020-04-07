#!/bin/sh

if [ $# -ne 2 ]
then
        echo "USAGE: $0 FULL_PATH_TO_TOPOLOGY-PROCESSOR_FILE FULL_PATH_TO GROUP_FILE"
        exit 2
fi

topo_file=${1}
group_file=${2}

echo "Do you want to clean up the old topology first? (y|n)"
read resp
if [ $resp == "y" ]
then
        echo "Running cleanup script. If not found go find it and place it in this directory."
        ./xl_cleanup_topo.sh
fi

# Download the group diagnostics zip file and the topology-processor diagnostics zip file directly, or by extracting it from a customer topology. The file names will be something along the lines of group-55d6966c46-5dlkf-diags.zip and topology-processor-1-diags.zip
# Retrieve the topology-processor component IP address as follows:

topo_ip=`kubectl get services -n turbonomic | grep topology-processor | grep 8080 | awk '{print $3}'`

# Load the topology-processor diagnostics into the topology-processor as follows:
echo "Loading topology-processor diags - this can take a few minutes ...."

curl --header 'Content-Type: application/zip' --data-binary @${topo_file} http://${topo_ip}:8080/internal-state
ret_code=$?
while [ $ret_code -ne 0 ]
do
        echo "Trying again ..."
        sleep 10
    curl --header 'Content-Type: application/zip' --data-binary @${topo_file} http://${topo_ip}:8080/internal-state
        ret_code=$?
done
echo ""

# Retrieve the group component IP address as follows:
group_ip=`kubectl get services -n turbonomic | grep group | grep 8080 | awk '{print $3}'`

# Load the group diagnostics into the topology-processor as follows:
echo "Loading group diags - this can take a few minutes ...."
curl --header 'Content-Type: application/zip' --data-binary @${group_file} http://${group_ip}:8080/internal-state
ret_code=$?
while [ $ret_code -ne 0 ]
do
        echo "Trying again ..."
        sleep 10
        curl --header 'Content-Type: application/zip' --data-binary @${group_file} http://${group_ip}:8080/internal-state
        ret_code=$?
done

echo ""