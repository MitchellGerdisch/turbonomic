package main

import (
    "bytes"
 	"mime/multipart"
	"encoding/json"
	"strings"
    "fmt"
    "io/ioutil"
    "net/http"
    "crypto/tls"
    "flag"
    "os"
    "encoding/csv"
    "io"
    //"reflect"
)

/* Currently not using these structures and instead using the map/interface unstructured approach to the API JSON
type CriteriaList struct {
	expType string 
	expVal string 
	filterType string 
	caseSensitive bool
}
type SearchBody struct {
	criteriaList CriteriaList 
	logicalOperator string 
	className string 
}

type SearchResult struct {
	uuid string
	displayName string
}
*/

type Action struct {
	actionTarget string
	actionUuid string
	actionDetails string
	actionFrom string
	actionTo string
}

type AppServer struct {
	appId string
	serverActions []Action
}

func main() {

	// command line arguments
	turbo_user := flag.String("turbo_user", "", "Turbo Username")
	turbo_password:= flag.String("turbo_password", "", "Turbo Password")
	turbo_instance := flag.String("turbo_instance", "", "Turbo IP or FQDN")
	csv_file := flag.String("csv_file", "", "CSV File containing App to Server mapping - \"Component_id\" and \"Server_Name\" columns required")
	powerbi_stream_url := flag.String("powerbi_stream_url", "", "URL for the PowerBI Stream Dataset")

	flag.Parse()
	
	if ((*turbo_user == "") || (*turbo_password == "") || (*turbo_instance == "") || (*csv_file == "") || (*powerbi_stream_url == "")) {
		fmt.Println("*************")
		fmt.Println("Missing command line argument ...")
		fmt.Println("Run \""+os.Args[0]+" -h\" for more information.")
		fmt.Println("*************")
		os.Exit(1)
	}
	// end command line arguments

	// Turbo authentication
	jsessionidCookie := turboLogin(*turbo_instance, *turbo_user, *turbo_password) 


// need logic to get csv mapping info and
// loop through and get vm id and actions and build that mapping to app

	appservercsv, err := os.Open(*csv_file)
	if (err != nil) {
		fmt.Println("*** Error opening file: "+ *csv_file)
		os.Exit(5)
	}

	readfile := csv.NewReader(appservercsv)
	
	var [][]appServerRecords string // This holds all the records from the CSV file that contain app and servers
	appServerRecords = getAppServerRecords(*csv_file)
	var ci_index string // This holds 
	var sn_index string
	ci_index, sn_index, records := get
	
	var []appServers AppServer
	currentAppServerIndex := 0  // index into appServers for given app
	currentAppName := "nowayanythingisnamedthis"
	currentServerName := "nowayanythingisnamedthiseither"
	var []serverActions Action
	var server string
	
	for {
		record, err := readfile.Read()
		if (err == io.EOF) {
			break
		}	
		
		if (err != nil) {
			fmt.Println("*** Failed to read a record in CSV file.") 
		}
		
		// Find the Server_Name and Component_id columns
		var sn_index int
		var ci_index int
		// first time through
		if ((sn_index == nil) || (ci_index == nil)) {
			for index,content := range record {
				if (content == "Server_Name") {
					sn_index = index	
				} else if (content == "Component_id") {
					ci_index = index
			} 
		} else {
			// process the record for the app and server name
			record_app = record[ci_index]
			record_server = record[sn_index]
			if (currentAppName != record_app)	 {
				// This is a new app than the last one. So start a new entry in the appServer array	

			} else {
				// Still processing servers for the same app. So append actions to the current appServer array entry
				
			}
				
			
			
		}
		
		if ()
		
			
		
		
		
		
		
		fmt.Println(record)
	}


	//server_name := "turbonomic-7.21.5-DS"
	server_name := "MiniHost"
	// Get VM UUID
	server_uuid := getVmId(*turbo_instance, server_name, jsessionidCookie)
	fmt.Println("vmId: "+server_uuid)
	
	// Get action info for VM
	appServerActions := getServerActions(*turbo_instance, server_name, server_uuid, jsessionidCookie)
	
	fmt.Println(appServerActions)
	

}	

func getAppServerRecords(csv_file string) [][]string {

	// Open the file
	appservercsv, err := os.Open(csv_file)
	if (err != nil) {
		fmt.Println("*** Error opening file: "+ *csv_file)
		os.Exit(5)
	}
	readfile := csv.NewReader(appservercsv)
	
	var [][]appServerRecords string // This holds all the records from the CSV file that contain app and servers
	appServerRecords = getAppServerRecords(*csv_file)
	var ci_index string // This holds 
	var sn_index string
	ci_index, sn_index, records := get
	
	var []appServers AppServer
	currentAppServerIndex := 0  // index into appServers for given app
	currentAppName := "nowayanythingisnamedthis"
	currentServerName := "nowayanythingisnamedthiseither"
	var []serverActions Action
	var server string
	
	for {
		record, err := readfile.Read()
		if (err == io.EOF) {
			break
		}	
		
		if (err != nil) {
			fmt.Println("*** Failed to read a record in CSV file.") 
		}
		
		// Find the Server_Name and Component_id columns
		var sn_index int
		var ci_index int
		// first time through
		if ((sn_index == nil) || (ci_index == nil)) {
			for index,content := range record {
				if (content == "Server_Name") {
					sn_index = index	
				} else if (content == "Component_id") {
					ci_index = index
			} 
		} else {
			// process the record for the app and server name
			record_app = record[ci_index]
			record_server = record[sn_index]
			if (currentAppName != record_app)	 {
				// This is a new app than the last one. So start a new entry in the appServer array	

			} else {
				// Still processing servers for the same app. So append actions to the current appServer array entry
				
			}
				
			
			
		}
		
		if ()
		
				
	
	
}


// Get actions for given server UUID
func getServerActions (turbo_instance string, server_name string, server_id string,  auth string) []Action {

	url := "https://"+ turbo_instance +"/vmturbo/rest/entities/"+ server_id +"/actions" 
	method := "GET"
	
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}	

	// create and make the request
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Cookie", auth)
	res, err := client.Do(req)
	if err != nil {
    	fmt.Println(err)
    	os.Exit(3)
  	}

	defer res.Body.Close()
	// essentially creates a stringified version of the body's json
	body, _ := ioutil.ReadAll(res.Body)
	
	// Since the search results is an array of json,
	// Create an array of one of these interface things to unmarshal the stringified json into
	var responseActions []map[string]interface{}
	err = json.Unmarshal([]byte(body), &responseActions)
	if err != nil {
		fmt.Println(err)
    	os.Exit(4)
	}

	var serverActions []Action
	for _, responseAction := range responseActions {
		var serverAction Action
		serverAction.actionUuid = responseAction["uuid"].(string)
		serverAction.actionTarget = responseAction["target"].(map[string]interface{})["displayName"].(string)
		serverAction.actionDetails = responseAction["details"].(string)
		if  (responseAction["target"].(map[string]interface{})["environmentType"] == "CLOUD") {
			serverAction.actionFrom = responseAction["currentEntity"].(map[string]interface{})["displayName"].(string)
			serverAction.actionTo = responseAction["newEntity"].(map[string]interface{})["displayName"].(string)
		} else {
			serverAction.actionFrom = "NA"
			serverAction.actionTo = "NA"
		}
		serverActions = append(serverActions, serverAction)
	}
	
	return serverActions
}	
	
	
	/*
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
*/

// get VM UUID
func getVmId(turbo_instance string, server_name string, auth string) string {

	url := "https://"+ turbo_instance +"/api/v3/search?q="
	method := "POST"
	
	// test payload for now
	vm_payload := strings.NewReader("{\n  \"className\": \"VirtualMachine\",\n  \"criteriaList\": [\n    {\n      \"expVal\": \"^"+server_name+"$\",\n      \"caseSensitive\": \"\",\n      \"filterType\": \"vmsByName\",\n      \"expType\": \"RXEQ\"\n    }\n  ],\n  \"logicalOperator\": \"AND\"\n}")
	
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}	

	// create and make the request
	req, err := http.NewRequest(method, url, vm_payload)
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Cookie", auth)
	res, err := client.Do(req)
	if err != nil {
    	fmt.Println(err)
    	os.Exit(3)
  	}

	defer res.Body.Close()
	// essentially creates a stringified version of the body's json
	body, _ := ioutil.ReadAll(res.Body)
	//fmt.Println(string(body))
	
	// Since the search results is an array of json,
	// Create an array of one of these interface things to unmarshal the stringified json into
	var searchResults []map[string]interface{}
	err = json.Unmarshal([]byte(body), &searchResults)
	if err != nil {
		fmt.Println(err)
    	os.Exit(4)
	}
	// now searchResults is an array of structures that we can index.
	// There's only one result so we're hardcoding the array index and we only care about the uuid
	//fmt.Println("searchResults")
	//fmt.Println(searchResults[0]["uuid"])
	
	return searchResults[0]["uuid"].(string)
}	

// Login to turbo
func turboLogin(turbo_instance string, turbo_user string, turbo_password string) string {

	fmt.Println("Authenticating to Turbonomic instance, "+turbo_instance) 

  	url := "https://"+ turbo_instance +"/vmturbo/rest/login"
  	method := "POST"

  	payload := &bytes.Buffer{}
  	writer := multipart.NewWriter(payload)
  	_ = writer.WriteField("username", turbo_user)
  	_ = writer.WriteField("password", turbo_password)
  	err := writer.Close()
  	if err != nil {
    	fmt.Println(err)
    	os.Exit(2)
  	}

	// set up the request client to ignore self-signed cert from Turbo
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}

  	req, err := http.NewRequest(method, url, payload)
  	if err != nil {
    	fmt.Println(err)
  	}
  	req.Header.Set("Content-Type", writer.FormDataContentType())
  	res, err := client.Do(req) // send the post request, "res" has the response
  	if err != nil {
    	fmt.Println(err)
  	}
  	defer res.Body.Close()
  	//body, err := ioutil.ReadAll(res.Body)
  	//fmt.Println(string(body))
  	
  	// get the jsessionid cookie for subsequent requests
  	// This is inelegant code at this time that relies on knowing there is one cookie, the first part of which is the jsessionID bit	
  	cookie := res.Cookies()	
  	jsessionid_cookie := cookie[0].Name + "=" + cookie[0].Value
  	
	return jsessionid_cookie
}

