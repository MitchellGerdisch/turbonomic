/*
 * Super sunny day script used to set up Action Script poolicy on XL.
 * Has all sorts of assumptions built in related to the action scripts and manifest colocated with this script.
 */



async function createActionScriptPolicy(group_name, policy_name) {
	
	if ((group_name == null) || (group_name == "")) {
		console.log("**** USAGE: createActionScriptPolicy(\"GROUP NAME\" ,\"POLICY NAME\")")
		return
	}
	if ((policy_name == null) || (policy_name == "")) {
		console.log("**** USAGE: createActionScriptPolicy(\"GROUP NAME\" ,\"POLICY NAME\")")
		return
	}
	
	group_id = await getUuid("Group", group_name)
	
	SM_settings = await buildSettingsManagerSettings()
	
	/* build and send the orchestration policy API call */
	api_body = {
	    "disabled":"false",
	    "displayName":policy_name,
	    "scopes": [{"uuid": group_id}],
	    "settingsManagers": [
	    	{
	    		"uuid": "controlmanager",
	    		"settings": SM_settings,
	    	}
	    ]
	}
	
	response = await fetch('/vmturbo/rest/settingspolicies', {
		method: "POST",
		body: JSON.stringify(api_body),
	    headers: {
	        'Content-Type': 'application/json'
	      }
	})
	policy = await response.json()
	
	console.log("*** Policy configuration. If you don't see the action scripts in this json, something went wrong.")
	console.log("")
	console.log(JSON.stringify(policy))
	console.log("")
	console.log("*** Orchestration Policy, "+policy_name+", for group, "+group_name+", created.")
}

/* 
 * Get the workflows and build the settingsManager settings array for the action orchestration policy
 * This function is tightly bound to the colocated scripts and their names.
 * It simply matches the found workflow name that needs to match what is in the manifest file with the application controlManager UUID that needs to be passed in the policy creation.
 * 
 * The current controlmanager UUID list is listed in the settings array in this construct:
 *  "controlmanager": {
      "displayName": "Action Workflow",
      "defaultCategory": "Automation",
      "settings": [
        "activateActionWorkflow",
        "moveActionWorkflow",
        "provisionActionWorkflow",
        "resizeActionWorkflow",
        "suspendActionWorkflow",
        "deleteActionWorkflow",
        "preActivateActionWorkflow",
        "preMoveActionWorkflow",
        "preProvisionActionWorkflow",
        "preResizeActionWorkflow",
        "preSuspendActionWorkflow",
        "preDeleteActionWorkflow",
        "postActivateActionWorkflow",
        "postMoveActionWorkflow",
        "postProvisionActionWorkflow",
        "postResizeActionWorkflow",
        "postSuspendActionWorkflow",
        "postDeleteActionWorkflow"
      ]
    }
 */
async function buildSettingsManagerSettings() {
	
	response = await fetch('/api/v3/workflows')
	workflows = await response.json()
	
	SM_settings = []
	
	for (w = 0; w < workflows.length; w++) {
		workflow = workflows[w]
		
		/* The cm_id should match the name given in the comments above. */
		switch (workflow.displayName) {
			case "replace_resize_vm":
				cm_id = "resizeActionWorkflow"
				as_id = workflow.uuid
				break;
			case "replace_move_vm":
				cm_id = "moveActionWorkflow"
				as_id = workflow.uuid
				break;
			case "post_resize_vm":
				cm_id = "postResizeActionWorkflow"
				as_id = workflow.uuid
				break;
			case "post_move_vm":
				cm_id = "postMoveActionWorkflow"
				as_id = workflow.uuid
				break;
		}
		SM_settings.push({ "uuid": cm_id, "value": as_id})
	}
	return SM_settings
}



/* Returns UUID for named entity of given type */
async function getUuid(entity_type, entity_name) {
	if (entity_type == "BusApp") {
		filterType = "busAppsByName"
		className = "BusinessApplication"
	} else if (entity_type == "Group") {
		filterType = "groupsByName"
		className = "Group"
	} else if (entity_type == "Cluster") {
		filterType = "clustersByName"
		className = "Cluster"
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