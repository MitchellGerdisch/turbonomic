#!/bin/sh

# PREREQUISITES
# aws cli installed
# aws configure run to set up the credentials and region
#
# CAVEATS:
#    lots of values are hard-coded for the summit use-case
#
# SET number_instances to specify how many instances to launch

region="us-east-2"
number_instances=1
instance_start_number=1
instance_stop_number=`expr $instance_start_number + $number_instances`

name_base="SummitLab"

count=${instance_start_number}

while [ $count -lt $instance_stop_number ]
do
  instance_name="${name_base}-${count}"
  echo "launching $instance_name"

  aws ec2 run-instances \
  --count 1 \
  --image-id "ami-07d7614e1dd77cd70" \
  --instance-type "m5.large" \
  --key-name "summitlab2019" \
  --security-groups "kubestudent" \
  --iam-instance-profile Name=SummitLab \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$instance_name}]" \
  --block-device-mappings  DeviceName=/dev/sda1,Ebs={DeleteOnTermination=true}

  count=`expr $count + 1`
done

  instance_name="${name_base}-instructor"
  echo "launching $instance_name"

  aws ec2 run-instances \
  --count 1 \
  --image-id "ami-07d7614e1dd77cd70" \
  --instance-type "m5.large" \
  --key-name "summitlab2019" \
  --security-groups "kubestudent" \
  --iam-instance-profile Name=SummitLab \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$instance_name}]" \
  --block-device-mappings  DeviceName=/dev/sda1,Ebs={DeleteOnTermination=true}
  
  
#aws ec2 describe-instances --filters "Name=tag:Name,Values=SummitLab-*" | jq '.[] | .[] | .Instances | .[] | .InstanceId'
aws ec2 describe-instances --region ${region} --filters "Name=tag:Name,Values=SummitLab-*" | jq '.[] | .[] | .Instances[].Tags[].Value + "," + .Instances[].InstanceId + "," + .Instances[].PublicIpAddress' | sed 's/"//g'

