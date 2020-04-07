#!/bin/sh

# find the consul- pod for later use
consul_pod=`kubectl get pods | grep 'consul-' | awk '{print $1}'`

# Stop the t8c-operator or components may come up by themselves, mandatory for 7.21.x instances
kubectl scale --replicas=0 deployment t8c-operator

# Topology-processor cleanup
kubectl scale --replicas=0 deployment topology-processor
mysql -u root --password=vmturbo -e 'drop database topology_processor;'
kubectl exec -it ${consul_pod} -- consul kv delete --recurse topology-processor-
kubectl scale --replicas=1 deployment topology-processor

# Group cleanup
kubectl scale --replicas=0 deployment group
kubectl scale --replicas=0 deployment group
mysql -u root --password=vmturbo -e 'drop database group_component;'
kubectl exec -it ${consul_pod} -- consul kv delete --recurse group-
kubectl scale --replicas=1 deployment group

# Start up the t8c-operator, it will bring up the group and topology-processor
kubectl scale --replicas=1 deployment t8c-operator