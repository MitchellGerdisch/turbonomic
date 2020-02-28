/*
 * The default approach for the SNOW orchestration policy is to create both the CR and an audit record.
 * This can overwhelm SNOW sometimes, so this script creates the orch policy so that only the CR is created.
 * 
 * USAGE:
 * 	CreateSnowOrchPolicy(policy_name, group_match_string)
 *  where
 *  	policy_name is a quoted string with the name of the policy to be created
 *  	group_match_string is a quoted string that will be used to match on group names. This is NOT a regexp.
 *  
 *  E.g.
 *  CreateSnowOrchPolicy("My Great Orch Policy", "SNOW_VMs-"
 *  This will create a policy with name "My Great Orch Policy" scoped to all groups with the string "SNOW_VMs-" in their name.
 * 
 * CAVEAT: This is a sunny day script with no error handling.
 */


async function CreateSnowOrchPolicy(policy_name, group_search_string) {
	if ((policy_name == null) || (policy_name == "")) {
		console.log("**** Need to pass name for policy to be creatd.")
		console.log("**** USAGE: CreateSnowOrchPolicy(\"POLICY NAME\",\"GROUP SEARCH STRING\"")
		return
	}
	if ((group_search_string == null) || (group_search_string == "")) {
		console.log("**** Need to pass search string for groups the policy should be scoped to.")
		console.log("**** USAGE: CreateSnowOrchPolicy(\"POLICY NAME\",\"GROUP SEARCH STRING\"")
		return
	}
	
	/* Find groups and related IDs based on the search string passed in. */
	console.log("Finding groups with names that match, "+group_search_string)
	orch_groups = await getGroups(group_search_string)
	if (orch_groups.length == 0) {
		console.log("No groups found. Exiting.")
		return
	}
	console.log("Found "+orch_groups.length+" groups that matched the string given. Here's the list:")
	group_names = orch_groups.map(orch_group => orch_group.displayName)
	console.log(JSON.stringify(group_names))
	
	/* Now create the policy */
	/* first build the scopes section of the policy creation body */
	console.log("\nCreating policy, "+policy_name+" ...")
	scopes = []
	for (i = 0; i < orch_groups.length; i++) {
		group_uuid = await getUuid("Group",group_names[i])
		scopes.push({
			"uuid":group_uuid
		})
	}
	
	settingsManagers = [
		    {
		      "uuid": "actionscriptmanager",
		      "settings": [
		        {
		          "uuid": "preResizeVM",
		          "value": "false"
		        },
		        {
		          "uuid": "resizeVM",
		          "value": "false"
		        },
		        {
		          "uuid": "postResizeVM",
		          "value": "false"
		        },
		        {
		          "uuid": "approvalBackendResizeVM",
		          "value": "ServiceNow"
		        },
		        {
		          "uuid": "auditAfterExecResizeVM",
		          "value": "ServiceNow"
		        }
		      ]
		    }
    ]
	
	policy_body = {
		"disabled": false,
		"displayName": policy_name,
		"scopes": scopes,
		"settingsManagers": settingsManagers
	}	

	response = await fetch('/api/v2/settingspolicies', {
		method: 'POST',
		body: JSON.stringify(policy_body),
		headers: {
			'Content-Type': 'application/json'
		}
	})
	console.log("If no error is seen above, then policy, "+policy_name+", was created.")
}

async function getGroups(group_search_string) {
	 request_body = {
		 "criteriaList": [],
	 	 "logicalOperator": "AND",
	 	 "className": "Group",
	 	 "scope": null
	 }
	 response = await fetch('/api/v2/search/?ascending=false&disable_hateoas=true&order_by=severity&q='+group_search_string, {
	 	 method: 'POST',
	 	 body: JSON.stringify(request_body),
	 	 headers: {
	 		  'Content-Type': 'application/json'
	 	 }
	 })
	 return await response.json() 
}
			

/* Returns UUID for named entity of given type */
async function getUuid(entity_type, entity_name) {
	if (entity_type == "BusApp") {
		filterType = "busAppsByName"
		className = "BusinessApplication"
	} else if (entity_type == "Group") {
		filterType = "groupsByName"
		className = "Group"
	} else {
		console.log("getUuid: Called with incorrect entity_type")
		return 0
	}

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
		return info[0].uuid
	}
}