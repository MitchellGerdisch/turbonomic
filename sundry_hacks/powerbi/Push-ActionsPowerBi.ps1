<#
.SYNOPSIS 

.EXAMPLE
PushTurboActions_PowerBI.ps1 -TurboInstance turbonomic.mycompany.com -TurboCredential $TurboCred -PowerBiCredential $PowerBiKey -AppServerMapCsv appserver.csv
For the servers associated with each applicatin found in the provided CSV, this script will push a separate row of data to the given Power BI stream 
where each row provides the application, the server and action data.

.PARAMETER TurboInstance
Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.

.PARAMETER TurboCredential
Specify the credentials for the Turbonomic server. This must be a PSCredential object. You can use the Get-Credential cmdlet to create a variable to store your credentials and then pass the variable to this parameter.

.PARAMETER PowerBiStreamUrl
Currently, this is the URL with the key that one gets when creating a Streaming DataSet set in PowerBI.
(Eventually, this may be replaced with a PowerBI API credentials as configured via registering an app from dev.powerbi.com or a service prinicipal creds.)

.PARAMETER AppServerMapCsv
Specify the path to a CSV that contains at least two columns: 
- Component_id: This is the Application identifier
- Server_Name: This is the server associated with the given component_id.
Note this parameter may become vestigial or replaced once there is an API to get this information.

.PARAMETER DebugMode
Enable debug mode. Default is off.
#>

param (
   [string] $TurboInstance, ## Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.
    
   [System.Management.Automation.CredentialAttribute()] $TurboCredential, ## Specify a PSCredential object. If not provided, you will be prompted.

   [string] $PowerBiStreamUrl, ## The URL with the key that one gets when creating a Streaming DataSet set in PowerBI.

   [string] $AppServerMapCsv, ## The path to a CSV that contains at least two columns: Component_Id and Server_Name.
   
   [string] $DebugMode = "false" ## true or false to enable debug messages. Default is off
)

# Because Turbonomic is normally installed with self-signed certs, we need PowerShell to allow a self-signed cert.
function _SetCertPolicy {
    if ($PSVersionTable.PSEdition -eq 'Core') {
        if ($PSDefaultParameterValues.Contains("Invoke-RestMethod:SkipCertificateCheck")){
            $PSDefaultParameterValues["Invoke-RestMethod:SkipCertificateCheck"] = $true
        } else {
            $PSDefaultParameterValues.Add("Invoke-RestMethod:SkipCertificateCheck", $true)
        }
        if ($PSDefaultParameterValues.Contains("Invoke-WebRequest:SkipCertificateCheck")){
            $PSDefaultParameterValues["Invoke-WebRequest:SkipCertificateCheck"] = $true
        } else {
            $PSDefaultParameterValues.Add("Invoke-WebRequest:SkipCertificateCheck", $true)
        }
    } else {
        Add-Type -TypeDefinition @"
        using System.Net;
        using System.Security.Cryptography.X509Certificates;
        public class TrustAllCertsPolicy : ICertificatePolicy {
            public bool CheckValidationResult(
                ServicePoint srvPoint, X509Certificate certificate,
                WebRequest request, int certificateProblem) {
                return true;
            }
        }
"@
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object -TypeName TrustAllCertsPolicy
    }
}

function TurboLogin($turboInstance, $turboCredential) {
	
	$turboPassword = $turboCredential.GetNetworkCredential().password
	$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $turboCredential.username,$turboPassword)))
	
	$headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
	$headers.Add("Authorization", "Basic $base64AuthInfo")

	$multipartContent = [System.Net.Http.MultipartFormDataContent]::new()
	$stringHeader = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new("form-data")
	$stringHeader.Name = "username"
	$StringContent = [System.Net.Http.StringContent]::new($turboCredential.username)
	$StringContent.Headers.ContentDisposition = $stringHeader
	$multipartContent.Add($stringContent)

	$stringHeader = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new("form-data")
	$stringHeader.Name = "password"
	$StringContent = [System.Net.Http.StringContent]::new($turboPassword)
	$StringContent.Headers.ContentDisposition = $stringHeader
	$multipartContent.Add($stringContent)

	$body = $multipartContent

	$response = Invoke-WebRequest "https://$turboInstance/vmturbo/rest/login" -Method "POST" -Headers $headers -Body $body 
	$jessionid = $response.Headers["Set-Cookie"].split(";")[0]
	
	# Return the cookie for future API calls
	$jessionid	
}

# Process the CSV and return an array of JSON data that provides a mapping of the application and related servers.
# This is mostly done to allow for future mechanisms (e.g. API calls) to get this data instead of using a CSV file.
function BuildAppServerMapping($appServerMapCsv) {
	
	Write-Debug -Message "CSV Path: $appServerMapCsv"
	
	# Gather the CSV into JSON format for processing
	$csvJson = Import-Csv $appServerMapCsv |  ConvertTo-Json  | ConvertFrom-Json
	
	$appServerMapping = @{}
	foreach ($item in $csvJson) {
		$component_id = $item."Component_id"
		$serverName = $item."Server_Name"
		if (-Not $appServerMapping.ContainsKey($component_id)) {
			# first time finding this component_id, so initialize the associated array
			$appServerMapping.add($component_id, @{$serverName=@()}) 
		} else {
			if (-Not $appServermapping.$component_id.ContainsKey($serverName)) { # protects against a given app having the same server name twice. shouldn't happen
				$appServerMapping.$component_id.add($serverName, @())
			}
		}
	}	
	
	# Return the mapping
	$appServerMapping
}

# Get UUID for the VM
function GetTurboVmId($entityName, $turboInstance, $authorization) {
	
	$searchDTO = @{
		"criteriaList" = @(
			@{
				"expType" = "RXEQ"; 
				"expVal" =  "^$entityName$";
				"filterType" = "vmsByName";
				"caseSensitive" = true
			}
		);
		"logicalOperator" = "AND";
		"className" = "VirtualMachine"
    }
    $searchDTOJson = $searchDTO | ConvertTo-Json
    
	$uri = "https://{0}/vmturbo/rest/search?q=" -f $turboInstance
	#$uri = "https://{0}/api/v3/search?q=" -f $turboInstance
	
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
		$searchResponse = Invoke-RestMethod -Uri $uri -Method Post -Headers @{Cookie=("{0}" -f $authorization); "Content-Type"="application/json"} -Body $searchDTOJson 
		$vmId = $searchResponse[0].uuid
	} catch {
		Write-Host "Turbonomic API: Error searching for VM, $entityName"
		Write-Host "StatusCode:" $_.Exception.Response.StatusCode.value__ 
    	Write-Host "StatusDescription:" $_.Exception.Response.ReasonPhrase
	}
	
	$vmId
}

# Get actions for the given UUID
function GetServerActions($serverName, $serverUuid, $turboInstance, $authorization) {
	Write-Debug -Message "In getActions"
	
	$entityActions = @()
	$uri = "https://{0}/vmturbo/rest/entities/{1}/actions" -f $turboInstance, $serverUuid
	#$uri = "https://{0}/api/v3/entities/{1}/actions?order_by=severity&ascending=true" -f $turboInstance, $serverUuid
	[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
    	$headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
		$headers.Add("Cookie", $authorization)
		$resp = Invoke-RestMethod $uri -Method 'GET' -Headers $headers 

		$resp | ForEach-Object {
			$actionObject = $_ 
			if ($actionObject.target.environmentType -eq "CLOUD") {
				$actionFrom = $actionObject.currentEntity.displayName
				$actionTo = $actionObject.newEntity.displayName
			} else {
				$actionFrom = "NA"
				$actionTo = "NA"
			}
			$action_hash = @{
				"action_target" = $serverName;
				"action_uuid" = $actionObject.uuid;
				"action_details" = $actionObject.details; 
				"action_from" = $actionFrom;
				"action_to" = $actionTo;
			}
			$entityActions += $action_hash
		}
	} catch {
		Write-Host "Turbonomic API: Error getting actions for UUID, $uuid"
		Write-Host "StatusCode:" $_.Exception.Response.StatusCode.value__ 
    	Write-Host "StatusDescription:" $_.Exception.Response.ReasonPhrase
	}
	
	$entityActions
}


# Cycles throught the App-Server mapping and collects actions for each App's servers.
function GetAppActions($appServerMapping, $turboInstance, $turboCredential) {
	# Authenticate
	$auth = TurboLogin $turboInstance $turboCredential
	
	# Go through the hash and for each app find the servers and for each server find any actions.
	# And build a hash that maps each app to an array of hashes that represent each action for each server.
	$appIds = $appServerMapping.Keys
	$appActions = @{}
	foreach ($appId in $appIds) {
		Write-Debug -Message "appId: $appId"
		$appServers = $AppServerMapping.$appId.Keys
		foreach ($appServer in $appServers) {
			Write-Debug -Message "server: $appServer"
			$appServerId = GetTurboVmId $appServer $turboInstance $auth
			if ($appServerId) {
				Write-Debug -Message "VM: $appServer; UUID: $appServerId"
				$serverActions = GetServerActions $appServer $appServerId $turboInstance $auth
				$appActions[$appId] += @($serverActions)
			}
		}
	}
	$appActions
}

# Take the array of app-specific hashes of actions and send to power bi
# It will push a row of data for each action and add a timestamp
function PushToPowerBi($powerBiStreamUrl, $appServerActions) {

	$timestamp = (Get-Date -UFormat "%Y-%m-%dT%R:00.000Z").ToString()
	Write-Debug "Timestamp: $timestamp"
		
	$apps = $appServerActions.Keys
	foreach ($app in $apps) {
		$appServerActions[$app] | ForEach-Object {
			$actionRow = $_
			$payload = @{
				"Timestamp" = $timestamp;
				"Component_ID" = $app;
				"Server_Name" = $actionRow.action_target;
				"Action_Details" = $actionRow.action_details;
				"Action_From" = $actionRow.action_from;
				"Action_To" = $actionRow.action_to;
			}
			Write-Debug "Sending row for app: $app; vm: $actionRow.action_target"
			Invoke-RestMethod -Method Post -Uri $powerBiStreamUrl -Body (ConvertTo-Json @($payload))
		}
	}
}	
	

# Script starts here
# Allow for self-signed certs
_SetCertPolicy

if(($TurboInstance -eq $null) -or $TurboInstance -eq "") {
	$TurboInstance = Read-Host -Prompt "Enter the IP Address, FQDN, or Hostname of the Turbonomic Server"
}

if($TurboCredential -eq $null) {
	$TurboCredential = Get-Credential -Message "Enter the credentials used to sign in to the Turbonomic server."
}

if(($PowerBiStreamUrl -eq $null) -or $PowerBiStreamUrl -eq "") {
	$PowerBiStreamUrl = Read-Host -Prompt "Enter the Power BI data stream URL"
}

if(($AppServerMapCsv -eq $null) -or $AppServerMapCsv -eq "") {
	$AppServerMapCsv = Read-Host -Prompt "Enter the path to the Application to Server Mapping CSV."
}

if($DebugMode -eq "true") {
	$DebugPreference = "Continue"
	Write-Debug -Message "Debug mode is currently enabled."
}

# Get the base Application - Server Mappings skeleton built
$AppServerMapping = BuildAppServerMapping $AppServerMapCsv	

# Fold in the actions for each server associated with each app
$AppActions = GetAppActions $AppServerMapping $TurboInstance $TurboCredential 

# Send the actions up to the Power BI stream dataset
PushToPowerBi $PowerBiStreamUrl $AppActions


