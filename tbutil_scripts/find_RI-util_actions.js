#! /usr/bin/env tbscript
/*
 * This script is a hack to find Cloud actions that increase RI utilization.
 * It's used to demonstrate Turbo's cleverness around scaling an instance to leverage unused RIs. 
 * 
 */

// print out usage instuctions
function usage() {
	println("")
	println("Usage is ...")
	println("")
	println("get_actions_by_cloud_accounts.js -c @TURBO_CREDS_NAME [-t] [-x [DIRECTORY]] [-m]") 
	println("")
	println("-c             Use given Turbonomic instance and creds that were set up using \"tbutil @TURBO_CREDS_NAME save credentials\" command as per tbutil documentation.")
	println("-t             OPTIONAL: Produce tabular output instead of default CSV output. Output will be to STDOUT.")
	println("-x             OPTIONAL: Produce XLSX output instead of default CSV output. Output will be placed in a file named \"turbo_actions_TIMESTAMP.xlsx\" where TIMESTAMP represents the current epoch time (seconds).")
	println("               XLSX file(s) will be placed in optionally specified DIRECTORY")
	println("-m             OPTIONAL: Produce separate output for each cloud account. ") 
	println("               If -x option also used, output will be placed in separate files named \"turbo_actions_CLOUDACCOUNT_TIMESTAMP.xlsx\" ")
	println("               where CLOUDACCOUNT is the cloud account ID, and TIMESTAMP represents the current epoch time (seconds).")
	println("")
	println("Notes:")
	println(" * Default behavior is output in CSV format listing all actions across all accounts.")
	println("")
	exit(2)
}

// output the data in the specified format
function output_data(output_type, file_name, headers, rows) {
	if (output_type == "table") {
		printTable(headers, rows)
	} else if (output_type == "csv") {
		printCsv(headers, rows)
	} else if (output_type == "xlsx") {
		println("Generating XLSX file: "+file_name)
		generate_xls(file_name, headers, rows)
	} else {
		println("*** ERROR: Unknown output_type.")
		exit(3)
	}
}

// output an xlsx file of the data
function generate_xls(file_name, headers, rows) {
	
	var wb = plugin("excel-plugin").open()

	// Add header
	wb.addRow("lb", headers)
	
	// Now add each row to the spreadsheet
	rows.forEach(function(row) {
		wb.addRow("l", row)
	})
	
	wb.save(file_name)
}

// Get the savings/investment information from an action object
function get_ri_info(action) {

	var ri_info = {
			"interesting": false,
			"orig_coverage": 0,
			"new_coverage": 0
	}
	if ("target" in action) {
		var target = action.target
		if ("aspects" in target) {
			var aspects = target.aspects
			if ("cloudAspect" in aspects) {
				var cloudAspect = aspects.cloudAspect
				if ("riCoveragePercentage" in cloudAspect) {
					ri_info.orig_coverage = cloudAspect.riCoveragePercentage
					if ("reservedInstance" in action) {
						var reservedInstance = action.reservedInstance
						if ("coupons" in reservedInstance) {
							var coupons = reservedInstance.coupons
							if (coupons.units == "RICoupon") {
								var new_coverage = Math.round((coupons.value/coupons.capacity.avg) * 100)
								if (new_coverage > 0) {
									ri_info.new_coverage = new_coverage
									ri_info.interesting = true
								}
							}
						}
					}
				}
			}
		}
	}
	
	return ri_info
}

// Get the savings/investment information from an action object
function get_financials(action) {
	
	var stats = action.stats
	stats.forEach(function(stat) {
		if (stat.name == "costPrice") {
			if (stat.filters[0].type == "savingsType") {
				savings = stat.value
				savings = parseFloat(savings)
			}
		}
	})

	var financials = {
		amount: savings,
		type: "Savings"
	}
	
	if (savings < 0) {
		financials.type = "Investment"
	}
	return financials
}

var output_type = "csv"
var file_name_root = "turbo_actions"
var file_directory = "."
var per_account_output = false

for (var a = 0; a < args.length; a+=1) {
	switch (args[a]) {
		case "-h":
			usage()
			break
		case "-t":
			output_type = "table"
			break
		case "-x":
			output_type = "xlsx"
		    file_directory = args[a+1]
			if (file_directory === undefined)
				file_directory = "."
			a+=1
			break
		case "-m":
			per_account_output = true
			break
		default:
			usage()
			break
	}
}
	
// CSV/table headers
//var headers = [ "Account Name", "Cloud Provider", "Cloud Account ID", "Savings|Investment", "$/h", "Target Name", "Target UUID", "Action to Take", "Reason for Action" ]
var headers = [ "Target Name", "Target UUID", "Original RI Coverage", "New RI Coverage", "Action to Take", "Reason for Action" ]
var rows = []

// Get the cloud accounts connected to the turbo box
var opts = {
		type: "DISCOVERED"
}
BUs = client.getBusinessUnits(opts)

if (BUs.length < 1) {
	rows.push(["No cloud accounts found.", "", "", "", "", "", ""])
}

var bu_displayName
var bu_cloudType
var bu_uuid

for (var i = 0; i < BUs.length; i +=1) {
	BU = BUs[i]
	if (BU.hasRelatedTarget) {
		// Grab some pertinent attributes
		bu_displayName = BU.targets[0].displayName // the name of the account as it was defined when creating the target 
		bu_cloudType = BU.cloudType // AWS, Azure, etc
		bu_uuid = BU.uuid // The cloud account ID
		
		// limit option limits the number of items in the response.
		// cursor is the index to the start of the next set of items. cursor=0 => start with the first one; cursor=5 => start with the 6th item
		var std_limit = 20
		var limit = std_limit
		var cursor = "0" // start at the beginning
		var bu_first_time = true
		while (cursor != "") {
			try {
				var buActions_opts = {
					limit: limit,
					cursor: cursor,
					ascending: false
				}
				buActions = client.getCurrentBusinessUnitActions( bu_uuid, buActions_opts ) 
				cursor = client.nextCursor()
				if (bu_first_time && (buActions.length == 0)) {
					rows.push([bu_displayName, bu_cloudType, bu_uuid, "No actions found for this cloud account", "", "", ""])
				}
				else {
					bu_first_time = false
					for (var j = 0; j < buActions.length; j +=1) {
						buAction = buActions[j]

						var ri_info = get_ri_info(buAction)
						if (ri_info.interesting) {
							// Found a BU action with interesting RI coverage info worth returning
							action_statement = buAction.details
							target_uuid = buAction.target.uuid
							target_name = buAction.target.displayName
							reason = buAction.risk.description
							
							var financials = get_financials(buAction)
							rows.push([target_name, target_uuid, ri_info.orig_coverage, ri_info.new_coverage, action_statement, reason])
						}
					}
				}
			} catch(err) {  // the likely error is the get BU Actions throws an error
				if (limit != 1) {
					limit = 1 // If so, go into step-by-step mode to skip over the problem child
				}
				else {
					rows.push([bu_displayName, bu_cloudType, bu_uuid, "*****", "SKIPPED ITEM", cursor, ""])
					cursor = (parseInt(cursor) + 1).toString() // skip over the bad one
					limit = std_limit // this is needed to reset the limit to the standard value after stepping over a bad one.
				}
			}
		}
		if (per_account_output == true) {
			var d = new Date()
			var datestamp = Math.round(d.getTime() / 1000)
			file_name = file_directory + "/" + file_name_root + "_" + bu_uuid + "_" + datestamp + ".xlsx"
			output_data(output_type, file_name, headers, rows)
			rows = [] // reset the rows for the next account
		}
	}
}

if (per_account_output == false) {
	var d = new Date()
	var datestamp = Math.round(d.getTime() / 1000)
	file_name = file_directory + "/" + file_name_root + "_" + datestamp + ".xlsx"
	output_data(output_type, file_name, headers, rows)
}

return 0;