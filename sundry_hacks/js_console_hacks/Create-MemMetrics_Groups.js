/* 
 * Builds groups of cloud instances with and without Memory Metrics enabled.
 * The existence of memory metrics is based on whether or not the memory utilization is 0% or not.
 * Also downloads two CSVs - one of VMs with memory metrics enabled and one of VMs without.
 */

/* Auto call the function to get things going */
CreateMemMetricsGroups()


PROCESSING NOTES:
	Search for all accounts
	Do the stats call API (see below) scoped for each? all? account UUIDs
			with cursor logic
	Run through the instances and their mem metrics and separate out those with >0 as mem metrics enabled

async function CreateMemMetricsGroups() { 
	
	console.log("")
	console.log("**** Looking for instances with and without memory metrics enabled ... this may take a few minutes ...")
	console.log("")
	
	/* get an array of cloud account uuids to use for getting the VM stats */
	cloud_account_ids = await getUuids("BusinessAccount")

	console.log("... found "+cloud_account_ids.length+" cloud accounts ...")
	console.log("... processing VMs' memory metrics ...") 
		
	instance_mem_metrics = await getInstanceMemMetrics(cloud_account_ids)

	if (instance_mem_metrics.length == 0) {
		console.log("*** Something is not working. No memory metrics data was found for any instances.")
		return
	}
	
	console.log(JSON.stringify(instance_mem_metrics))
		
		
		/*
		csvContentMemMetricsEnabled = "data:text/csv;charset=utf-8,";
		csvContentMemMetricsEnabled += "Instance Name,Instance ID,Mem Utilization
		csvContentMemMetricsDisabled = "data:text/csv;charset=utf-8,";
		csvContentMemMetricsDisabled += "Instance Name,Instance ID,Mem Utilization
		
		for (m = 0; m < instance_mem_metrics.length; m++) {
			cloud_instance = instance_mem_metrics[i]
			name = cloud_instance.name
			id = cloud_instance.id
			memutil = cloud_instance.memutil
			
			if (memutil > 0) {
				csvContentMemMetricsEnabled += name + "," + id + "," + memutil + "\n"
				***** DO GROUP STUFF TOO
			} else {
				csvContentMemMetricsDisabled += name + "," + id + "," + memutil + "\n"
				***** DO GROUP STUFF TOO
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
		*/
}
	
/*
 * Returns an array of all the UUIDs of the given type.
 * You can see the type by going to Search in the UI and selecting a given category.
 * For example, Accounts (i.e. Cloud Accounts) are type == BusinessAccount.
 */
async function getUuids(type) {
	uri = "/vmturbo/rest/search?disable_hateoas=true&q=&types="+type	
	response = await fetch(uri, {
			method: 'GET',
	    	headers: {
	        	'Content-Type': 'application/json'
	      	}
		})
	
	items = await response.json()
	
	if (items.length == 0) {
		console.log("No items of type, "+type+" found. Exiting.")
		return
	}
	console.log("Found "+items.length+" items of type, "+type+".")
	item_ids = items.map(item => item.uuid)

	return(item_ids)
}


async function getInstanceMemMetrics(cloudAccountIds) {
	
	/*base_uri = "/vmturbo/rest/stats?ascending=true&cursor="
	 * 
	 */
	base_uri = "/api/v3/stats?ascending=true&cursor="
	body = {
			"scopes":cloudAccountIds,
			"period":{
				"statistics":[
					{"name":"VMem"}
				]
			},
			"relatedType":"VirtualMachine"
	}
	
	console.log("*** DEBUG *** "+JSON.stringify(body))
	
	/* API defaults to 500 max elements - so use cursor attribute, if needed, to call API multiple times to get all the instances. */
	all_instances = []
	cursor = 0
	looking_for_instances = true
	stop = 0
	while (looking_for_instances) {
		uri = base_uri + cursor
		console.log("DEBUG URI: "+uri)
		instance_stats_response = await fetch(uri, {
			method: 'POST',
			body: JSON.stringify(body),
	    	headers: {
	        	'Content-Type': 'application/json'
	      	}
		})
		instance_stats = await instance_stats_response.json()	
		
		
		if (instance_stats.length > 0) {
			console.log("DEBUG Found instance_stats")
			console.log("DEBUG cursor before: "+cursor)
			console.log("DEBIG length: "+instance_stats.length)
			cursor = cursor + instance_stats.length 
			console.log("DEBUG cursor after: "+cursor)
			all_instances = all_instances.concat(instance_stats)
		} else {
			console.log("DEBUG done finding instance_stats")
			looking_for_instances = false
		}

		/* DEBUG */
		stop = stop+1
		if (stop > 3) {
			looking_for_instances = false
		} else {
			console.log("########")
			console.log(JSON.stringify(instance_stats[0]))

		}
	}
	
	return all_instances
}

/*
 * Get all cloud instances.
 */
/*
async function getCloudInstances() {

	base_uri = '/vmturbo/rest/search/?aspect_names=cloudAspect&q=&cursor='
	cloud_search_body = {"criteriaList":[{"expType":"EQ","expVal":"AWS|AZURE","filterType":"vmsByCloudProvider","caseSensitive":false}],"logicalOperator":"AND","className":"VirtualMachine","scope":null}
	
	/* API defaults to 500 max elements - so use cursor attribute, if needed, to call API multiple times to get all the instances. 
	all_instances = []
	cursor = 0
	looking_for_instances = true
	while (looking_for_instances) {
		uri = base_uri + cursor
		instance_search = await fetch(uri, {
			method: 'POST',
			body: JSON.stringify(cloud_search_body),
	    	headers: {
	        	'Content-Type': 'application/json'
	      	}
		})
		instances = await instance_search.json()	
		if (instances.length > 0) {
			cursor = cursor + instances.length 
			all_instances = all_instances.concat(instances)
		} else {
			looking_for_instances = false
		}
	}
	
	return all_instances
}
*/





/* Returns UUID for named entity of given type */
async function getUuid(entity_type, entity_name) {
	if (entity_type == "BusApp") {
		filterType = "busAppsByName"
		className = "BusinessApplication"
	} else if (entity_type == "Group") {
		filterType = "groupsByName"
		className = "Group"
	} else if (entity_type == "Account") {
		filterType = "businessAccountByName"
		className = "BusinessAccount"
	} else if (entity_type == "BillingFamily") {
		filterType = "billingFamilyByName"
		className = "BillingFamily"
	} else {
		console.log("getUuid: Called with incorrect entity_type")
		return 0
	}
	
	entity_name = regExpEscape(entity_name)

	search_body = {
			"criteriaList": [
				{
					"expType": "RXEQ",
					"expVal": "^"+entity_name+"$",  /* need to limit to exact name match only so anchor the name */
					"filterType": filterType,
					"caseSensitive": true 
				}
				],
				"logicalOperator": "AND",
				"className": className,
				"scope": null
	}
	response = await fetch('/vmturbo/rest/search', {
		method: 'POST',
		body: JSON.stringify(search_body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
	info =  await response.json()
	
	if (info.length > 0) {
		/* Found an existing entity so return uuid */
		return {
			"uuid":info[0].uuid,
			"name":info[0].displayName
		}
	}
}

function regExpEscape(literal_string) {
    return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}




/*

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
	
*/