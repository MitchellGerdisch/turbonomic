# Creates a big OR-ed regular expression that can be used to define a Virtual Machine dynamic group in Turbonomic
# Pulls together the list from a CSV with a column called "Name"

# INPUTS: 
#	CSV_FILE: A CSV file containing at least a column of "Name" containing the server name.
#
# OUTPUT: a regular expression of server names to be used as a Name filter for a Turbonomic Virtual Machine Dynamic group.

param(
[Parameter(Mandatory=$true)][string]$CSV_FILE
)

$JSON_STUFF = Import-Csv $CSV_FILE |  ConvertTo-Json  | ConvertFrom-Json

$SERVER_REGEXP = ""
$NUMBER_FOUND_SERVERS = 0
foreach ($ITEM in $JSON_STUFF) {
	$SERVER_NAME = $ITEM."Name"
	#Write-Output "Server Name: $SERVER_NAME"
	$OS = $ITEM."Operating System"
	if ($OS -match '.*2008.*') {
		#Write-Output "GOOD: $NAME --  $I_NAME -- $VERSION"
		$NAME_REGEXP = ".*$SERVER_NAME.*"
		if ($SERVER_REGEXP) {
			if (-Not $SERVER_REGEXP.Contains($NAME_REGEXP)) {
				$NUMBER_FOUND_SERVERS = $NUMBER_FOUND_SERVERS + 1
				$SERVER_REGEXP = "$SERVER_REGEXP|$NAME_REGEXP" 
			}
		} else {
			$NUMBER_FOUND_SERVERS = $NUMBER_FOUND_SERVERS + 1
			$SERVER_REGEXP = $NAME_REGEXP
		}
	}
}


Write-Output "Found $NUMBER_FOUND_SERVERS Servers"
Write-Output ""
Write-Output $SERVER_REGEXP