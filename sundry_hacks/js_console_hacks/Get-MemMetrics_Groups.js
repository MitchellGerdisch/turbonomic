/* 
 * Builds groups of cloud instances with and without Memory Metrics enabled.
 * The existence of memory metrics is based on whether or not the memory utilization is 0% or not.
 * Also downloads two CSVs - one of VMs with memory metrics enabled and one of VMs without.
 */

/* Auto call the function to get things going */
GetMemMetricsGroups()

async function GetMemMetricsGroups() { 
	
	console.log("")
	console.log("**** Looking for instances with and without memory metrics enabled ... this may take a few minutes ...")
	console.log("")
	
	current_market = await getCurrentMarket()
	if (current_market == 0) {
		console.log("*** ERROR *** Something is not right. No market was found.") 
		return
	}
	
	cloud_instances = await getCloudInstancesMemoryUtil(current_market)
	
	if (cloud_instances.length == 0) {
		console.log("*** NO CLOUD INSTANCES FOUND. ***")
	} else {
		console.log("*** grouping instances with memory metrics and without memory metrics ...")

		csvContentMemMetricsEnabled = "data:text/csv;charset=utf-8,";
		csvContentMemMetricsEnabled += "Instance Name,Instance ID,Mem Utilization
		csvContentMemMetricsDisabled = "data:text/csv;charset=utf-8,";
		csvContentMemMetricsDisabled += "Instance Name,Instance ID,Mem Utilization
		
		for (i = 0; i < cloud_instances.length; i++) {
			cloud_instance = cloud_instances[i]
			name = cloud_instance.name
			id = cloud_instance.id
			memutil = cloud_instance.memutil
			
			if (memutil > 0) {
				csvContentMemMetricsEnabled += name + "," + id + "," + memutil + "\n"
				DO GROUP STUFF TOO
			} else {
				csvContentMemMetricsDisabled += name + "," + id + "," + memutil + "\n"
				DO GROUP STUFF TOO
			}
		}

		console.log("*** Downloading CSVs containing instances with and without memory metrics.")
		link = document.createElement('a')
		link.setAttribute('href', encodeURI(csvContentMemMetricsEnabled));
		link.setAttribute('download', `turbonomic_MemMetricsEnabled_${(new Date()).getTime()}.csv`);
		link.click()
		link = document.createElement('a')
		link.setAttribute('href', encodeURI(csvContentMemMetricsDisabled));
		link.setAttribute('download', `turbonomic_MemMetricsDisabled_${(new Date()).getTime()}.csv`);
		link.click()
	}
}

async function findRiImprovingActions(market) {
	
	/* Only care about cloud related resize type of actions */
	actions_body = {
			"actionTypeList": [
				"RESIZE",
				"RIGHT_SIZE",
				"SCALE"
			],
			"environmentType": "CLOUD",
			"detailLevel": "EXECUTION"
	}
	
	/* API defaults to 500 max elements - so use cursor attribute, if needed, to call API multiple times to get all the actins. */
	all_actions = []
	cursor = 0
	looking_for_actions = true
	while (looking_for_actions) {
		uri = '/api/v3/markets/'+market+'/actions?cursor='+cursor
		action_fetch = await fetch(uri, {
			method: 'POST',
			body: JSON.stringify(actions_body),
	    	headers: {
	        	'Content-Type': 'application/json'
	      	}
		})
		actions = await action_fetch.json()	
		if (actions.length > 0) {
			cursor = cursor + actions.length 
			all_actions = all_actions.concat(actions)
		} else {
			looking_for_actions = false
		}
	}
	
	ri_improving_actions = []
	for (a = 0; a < all_actions.length; a++) {
		if ((a%100) == 0) {
			console.log("**** ... still looking for RI-improving actions ...")
		}
		action = all_actions[a]
		
		/* we need to get the details for the action to see RI coverage */
		response = await fetch('/api/v3/actions/'+action.uuid+'/details')
		action_details = await response.json()
		
		/* Check if any RI coverage information is available. */
		if ((action_details.riCoverageBefore) && (action_details.riCoverageAfter)) {
			/* do some math to see if RI usage improves because of this action */
			before_ri_capacity = action_details.riCoverageBefore.capacity.avg
			before_ri_usage = action_details.riCoverageBefore.value
			before_ri_utilization = (before_ri_capacity == 0 ? 0 : Math.round((before_ri_usage/before_ri_capacity)*100))

			after_ri_capacity = action_details.riCoverageAfter.capacity.avg
			after_ri_usage = action_details.riCoverageAfter.value
			after_ri_utilization = (after_ri_capacity == 0 ? 0 : Math.round((after_ri_usage/after_ri_capacity)*100))
			
			if (after_ri_utilization > before_ri_utilization) { 
				/* we got a good one */
				ri_improving_actions.push({
					"instance_name": action.target.displayName,
					"account_name": action.currentLocation.discoveredBy.displayName,
					"instance_id": Object.values(action.target.vendorIds)[0],
					"current_ri_util": before_ri_utilization,
					"new_ri_util": after_ri_utilization,
					"action": action.details,
					"reason": action.risk.subCategory,
					"reason_description": action.risk.description
				})
			}
		}
	}
	
	return ri_improving_actions
}

API call to get memory stats
Request URL: https://xl1.demo.turbonomic.com/vmturbo/rest/stats/?ascending=false&disable_hateoas=true&limit=50&order_by=VMem
	body: {"scopes":["284560650706242"],"period":{"statistics":[{"name":"VMem"},{"name":"costPrice"}]},"relatedType":"VirtualMachine"}

Response:
	with mem metrics: NOTE the VMem section VALUES have numbers > 0
	{
	    "uuid": "73454410482404",
	    "displayName": "AppDTurboAJNv3",
	    "className": "VirtualMachine",
	    "environmentType": "CLOUD",
	    "stats": [
	      {
	        "date": "2020-06-10T20:51:25Z",
	        "statistics": [
	          {
	            "name": "costPrice",
	            "relatedEntityType": "VirtualMachine",
	            "filters": [
	              {
	                "type": "costComponent",
	                "value": "ON_DEMAND_COMPUTE"
	              }
	            ],
	            "units": "$/h",
	            "values": {
	              "max": 0.146,
	              "min": 0.004,
	              "avg": 0.08584453,
	              "total": 0.2575336
	            },
	            "value": 0.08584453
	          },
	          {
	            "name": "VMem",
	            "capacity": {
	              "max": 7340032.0,
	              "min": 7340032.0,
	              "avg": 7340032.0,
	              "total": 7340032.0,
	              "totalMax": 7340032.0,
	              "totalMin": 7340032.0
	            },
	            "reserved": {
	              "max": 0.0,
	              "min": 0.0,
	              "avg": 0.0,
	              "total": 0.0
	            },
	            "filters": [
	              {
	                "type": "relation",
	                "value": "sold"
	              }
	            ],
	            "units": "KB",
	            "values": {
	              "max": 7076864.0,
	              "min": 7068262.5,
	              "avg": 7068262.5,
	              "total": 7068262.5,
	              "totalMax": 7076864.0,
	              "totalMin": 7068262.5
	            },
	            "value": 7068262.5
	          }
	        ],
	        "epoch": "HISTORICAL"
	      }
	    ]
	  },
	

async function getCurrentMarket() {
	response = await fetch('/api/v3/markets')
	markets = await response.json()
	for (m = 0; m < markets.length; m++) {
		market = markets[m]
		if (market.displayName == "Market") {
			return market.uuid
		}
	}
	return 0
}
