/*
 * INPUTS:
 * - VM Group name
 * - One or two VM Tag Key names for which to return value
 * 
 * OUTPUTS:
 * - CSV where each row has:
 *   - VM Name
 *   - VM UUID
 *   - VM Account name
 *   - VM Tag Value for identified tag key
 */

async function getGroupVMsAcctTag(group_name, tag_key_name, optional_tag_key_name) {
	
	
	if ((group_name == null) || (group_name == "")) {
		console.log("**** Need to pass name of VM group.")
		console.log("**** USAGE: getGroupVMsAcctTag(\"GROUP NAME\",\"VM TAG KEY NAME\",\"OPTIONAL ADDITIONAL TAG\"")
		return
	}
	if ((tag_key_name == null) || (tag_key_name == "")) {
		console.log("**** Need to pass name of key to return value for.")
		console.log("**** USAGE: getGroupVMsAcctTag(\"GROUP NAME\",\"VM TAG KEY NAME\",\"OPTIONAL ADDITIONAL TAG\"")
		return
	}
	
	
	group_uuid = await getUuid("Group", group_name)
	vm_list = await getGroupMembers(group_uuid)

	if (vm_list.length == 0) {
		console.log("No members found in group, "+group_name+" - Exiting.")
		return
	}
	console.log("Found "+vm_list.length+" VMs in group, "+group_name+".")

	/* collate data for each VM */
	vm_data = []
	for (i = 0; i < vm_list.length; i++) {
		vm = vm_list[i]
		vm_data.push({
			"name":vm.displayName,
			"uuid":vm.uuid,
			"account":vm.discoveredBy.displayName,
			"tag_value":vm.tags[tag_key_name][0],
			"opt_tag_value":vm.tags[optional_tag_key_name][0]
		})
	}
	
	csvContent = "data:text/csv;charset=utf-8,";
	csvContent += "Account,VM Name,VM UUID,"+tag_key_name+" Tag Value,"+optional_tag_key_name+" Tag Value\n"

	console.log("Downloading CSV containing VM data")
	for (k = 0; k < vm_data.length; k++) {
		vm = vm_data[k]
		
		csvContent += vm.account + "," + vm.name + "," + vm.uuid + "," + vm.tag_value + "," + vm.opt_tag_value + "\n"
	}
	
	link = document.createElement('a')
	link.setAttribute('href', encodeURI(csvContent));
	link.setAttribute('download', "vm_account_and_"+tag_key_name+"-tag-value_"+`${(new Date()).getTime()}.csv`);
	link.click();
	
	
}

async function getGroupMembers(uuid) {
	uri = "/api/v2/groups/"+uuid+"/members"
	
	response = await fetch(uri)
	members_json_array = await response.json()
	return members_json_array
}




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
		return info[0].uuid
	}
}

function regExpEscape(literal_string) {
    return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
