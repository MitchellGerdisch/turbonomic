package main

/*
.SYNOPSIS 

.DESCRIPTION
Pushes records to Power BI streaming dataset that provide application-server-actions information.
Requires a Power BI streaming dataset defined with the following fields:
- Timestamp (DateTime)
- Component_ID (Text)
- Component_Name (Text)
- Server_Name (Text)
- Action_Details (Text)
- Action_Type (Text)
- Action_From (Text)
- Action_To (Text)
- Reason (Text)
- Severity (Text)
- Category (Text)

.EXAMPLE
PushTurboActions_PowerBI.ps1 -TurboInstance turbonomic.mycompany.com -TurboCredential $TurboCred -PowerBiCredential $PowerBiKey -AppServerMapCsv appserver.csv
For the servers associated with each applicatin found in the provided CSV, this script will push a separate row of data to the given Power BI stream 
where each row provides the application, the server and action data.

.PARAMETER turbo_instance
Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.

.PARAMETER turbo_user
Specify the username for accessing Turbo. 

.PARAMETER turbo_password
Specify the password for accessing Turbo. 

.PARAMETER powerbi_stream_url
Currently, this is the URL with the key that one gets when creating a Streaming DataSet set in PowerBI.
(Eventually, this may be replaced with a PowerBI API credentials as configured via registering an app from dev.powerbi.com or a service prinicipal creds.)

.PARAMETER csv_file
Specify the path to a CSV that contains at least two columns: 
- Component_Id: This is the Application identifier
- Server_Name: This is the server associated with the given component_id.
Note this parameter may become vestigial or replaced once there is an API to get this information.

.PARAMETER action_type
Flag which action_type(s) to include in the output. 
Options: TBD

CROSS-COMPLIATION NOTES
env GOOS=windows GOARCH=amd64 go build ./push_turbo-actions.go

*/

import (
     "bytes"
  	"mime/multipart"
 	"encoding/json"
 	"strings"
 	"strconv"
     "fmt"
     "io/ioutil"
     "net/http"
     // used if debugging http "net/http/httputil"
     "crypto/tls"
     "flag"
     "os"
     "encoding/csv"
     "io"
     "time"
    //"reflect"
)

type Action struct {
	actionUuid string
	actionDetails string
	actionType string
	actionFrom string
	actionTo string
	reason string
	severity string
	category string
}

type ServerAction struct {
	serverName string
	serverUuid string
	actions []Action
}

type AppServerMapping struct {
	appId string
	appName string
	serverActions []ServerAction
}

func main() {

	// 2.x MAJOR VERSION NOTE: More efficient use of Turbo API to gather all actions first and then map them to servers in the CSV.
	// 2.1 MINOR VERSION NOTE: Fixed bug in HTTP payload when calling API for actions.
	// 2.2 MINOR VERSION NOTE: Changed PowerBI API logic to send sets of actions for a given application instead of one at a time for each server.
	// 2.3 MINOR VERSION NOTE: Updated code to build map of app to server to allow for more efficient processing.
	version := "2.3" 
	fmt.Println("push_turbo-actions version "+version)

	// Process command line arguments
	turbo_user := flag.String("turbo_user", "", "Turbo Username")
	turbo_password:= flag.String("turbo_password", "", "Turbo Password")
	turbo_instance := flag.String("turbo_instance", "", "Turbo IP or FQDN")
	csv_file := flag.String("csv_file", "", "CSV File containing App to Server mapping - \"Component_id\" and \"Server_Name\" columns required")
	powerbi_stream_url := flag.String("powerbi_stream_url", "", "URL for the PowerBI Stream Dataset")
	//action_type := flag.String("action_type", "", "(Optional) Actions to output. Options: TBD")

	flag.Parse()
	
	if ((*turbo_user == "") || (*turbo_password == "") || (*turbo_instance == "") || (*csv_file == "") || (*powerbi_stream_url == "")) {
		fmt.Println("*************")
		fmt.Println("Missing command line argument ...")
		fmt.Println("Run \""+os.Args[0]+" -h\" for more information.")
		fmt.Println("*************")
		
		fmt.Println("\n")
		fmt.Println("The PowerBI Streaming Dataset you are using must have the following fields set up with the types given in parentheses:")
		fmt.Println()
		fmt.Println("- Timestamp (DateTime)")
		fmt.Println("- Component_ID (Text)")
		fmt.Println("- Component_Name (Text)")
		fmt.Println("- Server_Name (Text)")
		fmt.Println("- Action_Details (Text)")
		fmt.Println("- Action_Type (Text)")
		fmt.Println("- Action_From (Text)")
		fmt.Println("- Action_To (Text)")
		fmt.Println("- Reason (Text)")
		fmt.Println("- Severity (Text)")
		fmt.Println("- Category (Text)")

		os.Exit(1)
	}
	// end command line arguments
	
	time_start := time.Now()
	
	// Process the CSV file to extract the Application to Server Mapping
	fmt.Println("*** Processing CSV file for application to server mapping ...")
	appId2Name,appId2Servers := getAppServerMapping(*csv_file)
	
	time_now := time.Now()
	time_elapsed := int(time_now.Sub(time_start).Seconds())
	fmt.Printf("took %d seconds.\n\n", time_elapsed)
	time_start = time_now
	
	// Call Turbo to get any actions for the servers assigned to each application
	fmt.Println("*** Getting actions from Turbo ...")
	allServerActions,serverUuids := getAllActions(*turbo_instance, *turbo_user, *turbo_password) 

	time_now = time.Now()
	time_elapsed = int(time_now.Sub(time_start).Seconds())
	fmt.Printf("took %d seconds.\n\n", time_elapsed)
	time_start = time_now

	// Call PowerBI API to push data to the stream dataset
	fmt.Println("*** Sending records to PowerBI ...")
	pushPowerBiData(appId2Name,appId2Servers,allServerActions,serverUuids, *powerbi_stream_url)

	time_now = time.Now()
	time_elapsed = int(time_now.Sub(time_start).Seconds())
	fmt.Printf("took %d seconds.\n\n", time_elapsed)
	time_start = time_now
	
	fmt.Println("Done.")
}

// Processes the CSV and creates a base mapping of applications (aka components) and servers
// Returns:
//   map: App ID -> App Name as given in the CSV
//   map: App ID -> array of Server Names as given in the CSV
func getAppServerMapping(csv_file string) (map[string]string, map[string][]string) {

	// Get size of file and application and server name column numbers for subsequent processing
	var componentIdColumn, componentNameColumn, serverNameColumn int
	_, componentIdColumn, componentNameColumn, serverNameColumn = getFileInfo(csv_file)
	
	// For storing the app to server mappings (and later the server actions)
	var appId2Name map[string]string
	var appId2Servers map[string][]string
	appId2Name = make(map[string]string)
	appId2Servers = make(map[string][]string)

	// Read through the file this time to build the application to server mapping
	fileLine := 1
	appservercsv, err := os.Open(csv_file)
	if (err != nil) {
		fmt.Println("*** Error opening file: "+ csv_file)
		os.Exit(5)
	}

	readfile := csv.NewReader(appservercsv)
	for {
		record, err := readfile.Read()
		if (err == io.EOF) {
			break
		}	

		if (err != nil) {
			fmt.Println("*** Failed to read a record in CSV file.") 
		} else {
			// Skip the first line which contains the column headings
			if (fileLine > 1) {
			
				appId := record[componentIdColumn]
				appName := record[componentNameColumn]
				serverName := record[serverNameColumn]
				
				appId2Name[appId] = appName	
				appId2Servers[appId] = append(appId2Servers[appId], serverName)
			}	
			fileLine += 1
		}
	}	
	
	return appId2Name, appId2Servers
}
// 
// // Calls Turbo API to get ALL current actions.
// // Returns:
// // - map: Server Name as found in the actions -> Server UUID(s) as found in the actions. This should be all the same UUIDs but it's being kept in case some debugging is needed.
// // - map: Server Name as found in the actions -> Array of Actions associated with the server.
// func getServerActions(turbo_instance string, turbo_user string, turbo_password string) (map[string][]string, map[string][]Action) {
// 	// Get all the resize actions for all the servers
// 	// This is more than we need, but it's the most efficient way to get the data out of Turbo's API.
// 	allServerActions,serverUuids := getAllActions(turbo_instance, turbo_user, turbo_password) 
// 
// 	// Each item from appServerMapping is a structure containing the application ID and server ID
// 	var serverName, serverUuid string
// 	var serverUuidsList []string
// 	for _,app := range appServerMapping {
// 		fmt.Println("Getting actions for servers in Application: "+app.appName)
// 		for srv_idx,server := range app.serverActions {
// 			// Get the actions for the given server and add to the given server's actions struct
// 			// If the server doesn't have any actions, serverUuidsList will be empty
// 			serverName = server.serverName
// 			serverUuidsList = serverUuids[serverName]
// 
// 			// skip any servers that do not have any actions in the actions map
// 			if (len(serverUuidsList) > 0) {
// 				serverUuid = serverUuidsList[0] 
// 				app.serverActions[srv_idx].serverUuid = serverUuid
// 				app.serverActions[srv_idx].actions = allServerActions[serverName]
// 			}
// 		}
// 	}
// 	return appServerMapping
// }


// Using the data found in the various maps, assemble API calls to push PowerBi to push the data stream
func pushPowerBiData(appId2Name map[string]string, appId2Servers map[string][]string, allServerActions map[string][]Action, serverUuids map[string][]string, powerbi_url string) {

	t := time.Now()
	timeString := t.Format(time.RFC3339)
  	method := "POST"
	
	for appId,appName := range appId2Name {
		var payload string
		for _,serverName := range appId2Servers[appId] {
			for _,action := range allServerActions[serverName] {
				timestamp_part := "\"Timestamp\": \""+timeString+"\""
				appid_part := "\"Component_ID\": \""+appId+"\""
				appname_part := "\"Component_Name\": \""+appName+"\""
				servername_part := "\"Server_Name\": \""+serverName+"\""
				actiondetails_part := "\"Action_Details\": \""+action.actionDetails+"\""
				actiontype_part := "\"Action_Type\": \""+action.actionType+"\""
				actionfrom_part := "\"Action_From\": \""+action.actionFrom+"\""
				actionto_part := "\"Action_To\": \""+action.actionTo+"\""
				reason_part := "\"Reason\": \""+action.reason+"\""
				severity_part := "\"Severity\": \""+action.severity+"\""
				category_part := "\"Category\": \""+action.category+"\""
				
				action_payload := "{"+timestamp_part+","+appid_part+","+appname_part+","+servername_part+","+actiondetails_part+","+actiontype_part+","+actionfrom_part+","+actionto_part+","+reason_part+","+severity_part+","+category_part+"}"
				if (payload == "") {
					payload =  "[" + action_payload
				} else {
					payload = payload + "," + action_payload
				}
  			}
	  	}
	  	payload = payload + "]"
		client := &http.Client {}
		req, err := http.NewRequest(method, powerbi_url, strings.NewReader(payload))
		if err != nil {
			fmt.Println(err)
		}
		req.Header.Add("Content-Type", "application/json")
		
// 		// For debugging HTTP Call
// 		requestDump, err := httputil.DumpRequest(req, true)
// 		if err != nil {
// 				fmt.Println(err)
// 		}
// 		fmt.Println(string(requestDump))
	
		res, _:= client.Do(req)
		defer res.Body.Close()
	}
}

// Does basic processing of the csv file
func getFileInfo(csv_file string) (int, int, int, int) {
	
	// Open the file
	appservercsv, err := os.Open(csv_file)
	if (err != nil) {
		fmt.Println("*** Error opening file: "+ csv_file)
		os.Exit(5)
	}
	readfile := csv.NewReader(appservercsv)

	// Run through the file and find the number of lines in the file and the columns that have the server name and app (i.e. component) id
	numLines := 0
	
	componentIdColName := "Component_Id"
	componentIdColumn := -1 
	componentNameColName := "Component_Name"
	componentNameColumn := -1 
	serverNameColName := "Server_Name"
	serverNameColumn := -1
	columnNameLine := -1
	for {
		record, err := readfile.Read()
		if (err == io.EOF) {
			break
		}	

		if (err != nil) {
			fmt.Println("*** Failed to read a record in CSV file.") 
		} else {
			numLines += 1

			for index,content := range record {
				if (content == componentIdColName) {
					componentIdColumn = index
					columnNameLine = numLines
				}  else if (content == serverNameColName) {
					serverNameColumn = index	
					columnNameLine = numLines
				}	else if (content == componentNameColName) {
					componentNameColumn = index	
					columnNameLine = numLines
				}
			}
		}
	}

	if (columnNameLine != 1) {
		// The CSV file needs to have the column headers at the top otherwise
		fmt.Println("*** CSV file MUST have the column names on the first line of the file. ***")
		os.Exit(10)
	}	
	
	if (componentIdColumn < 0) {
		fmt.Println("*** No \""+componentIdColName+"\" column found.")
		fmt.Println("*** Either the column heading is not there, or there's some weird ufeff character in that row.")
		os.Exit(11)
	}
	
	if (componentNameColumn < 0) {
		fmt.Println("*** No \""+componentNameColName+"\" column found.")
		fmt.Println("*** Either the column heading is not there, or there's some weird ufeff character in that row.")
		os.Exit(11)
	}

	if (serverNameColumn < 0) {
		fmt.Println("*** No \""+serverNameColName+"\" column found.")
		fmt.Println("*** Either the column heading is not there, or there's some weird ufeff character in that row.")
		os.Exit(11)
	}
	
	return numLines, componentIdColumn, componentNameColumn, serverNameColumn
}

// Calls Turbo Actions API to get all resize actions currently identified by Turbo.
// Returns:
// - map: Server Name as found in the actions -> Array of Server UUIDs found in the actions for the given server name. 
// - map: Server Name as found in the actions -> Array of Actions for the server.
// CAVEAT: This and related logic assumes server names are unique in the system. If that is not the case, then the server name -> server UUID mapping
// may be used to debug that and figure out how best to handle the situation. But since the CSV is the rosetta stone here and it does
// not have Turbo UUIDs in it, we have to use the Server Name as the key.
func getAllActions (turbo_instance string, turbo_user string, turbo_password string) (map[string][]Action, map[string][]string) {
	
	auth := turboLogin(turbo_instance, turbo_user, turbo_password) 
	
	base_url := "https://"+turbo_instance+"/vmturbo/rest/markets/Market/actions"
	url := base_url
	method := "POST"
	// We only care about resize actions
	payload := []byte(`{"actionTypeList":["RESIZE","RIGHT_SIZE","SCALE"],"environmentType":"HYBRID","detailLevel":"EXECUTION"}`)
	
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}	

	var allResizeActions map[string][]Action
	var allActionServerUuids map[string][]string
	allResizeActions = make(map[string][]Action)
	allActionServerUuids = make(map[string][]string)

	
	done := false
	for (!done) {
		// create and make the request
		req, err := http.NewRequest(method, url, bytes.NewBuffer(payload))
		if err != nil {
			fmt.Println(err)
		}
		req.Header.Add("Content-Type", "application/json")
		req.Header.Add("Cookie", auth)
		
// 		// For debugging HTTP Call
// 		requestDump, err := httputil.DumpRequest(req, true)
// 		if err != nil {
//   			fmt.Println(err)
// 		}
// 		fmt.Println(string(requestDump))
		
		res, err := client.Do(req)
		if err != nil {
    		fmt.Println(err)
    		os.Exit(3)
  		}

		defer res.Body.Close()
		// essentially creates a stringified version of the body's json
		body, _ := ioutil.ReadAll(res.Body)
		
		// Since the results is an array of json,
		// Create an array of one of these interface things to unmarshal the stringified json into
		var responseActions []map[string]interface{}
		err = json.Unmarshal([]byte(body), &responseActions)

 		if err != nil {
 			fmt.Println(err)
   			fmt.Printf("#### ERROR decoding response: %v\n", err)
    		if e, ok := err.(*json.SyntaxError); ok {
        		fmt.Printf("#### ERROR syntax error at byte offset %d\n", e.Offset)
    		}
    		fmt.Printf("#### ERROR response: %q\n", body)
 		}
		
		
		// Map that indexes by server name and contains all the resize actions for that server name
		// Later on we'll use that sever name to map the actions to the applicable application (aka componen)
		var allActions []Action
		var riskcommodity string
		var fromval, toval float64
		for _, responseAction := range responseActions {
			var serverName, serverUuid string
			var action Action
			var actionFrom, actionTo string
			
			serverName = responseAction["target"].(map[string]interface{})["displayName"].(string)
			serverUuid = responseAction["target"].(map[string]interface{})["uuid"].(string)
	
			action.actionUuid = responseAction["uuid"].(string)
			action.actionType = responseAction["actionType"].(string)
			action.reason = responseAction["risk"].(map[string]interface{})["description"].(string)
			action.severity = responseAction["risk"].(map[string]interface{})["severity"].(string)
			action.category = responseAction["risk"].(map[string]interface{})["subCategory"].(string)
			action.actionDetails = responseAction["details"].(string)
			if  (responseAction["target"].(map[string]interface{})["environmentType"] == "CLOUD") {
				actionFrom = responseAction["currentEntity"].(map[string]interface{})["displayName"].(string)
				actionTo = responseAction["newEntity"].(map[string]interface{})["displayName"].(string)
			} else {
				riskcommodity = responseAction["risk"].(map[string]interface{})["reasonCommodity"].(string)
				if (riskcommodity == "VCPU") {
					// Get CPU values (in float)
					fromval, _ = strconv.ParseFloat(responseAction["currentValue"].(string), 32)
					toval, _ = strconv.ParseFloat(responseAction["resizeToValue"].(string), 32)
					// Convert from float to int
					actionFrom = strconv.Itoa(int(fromval))
					actionTo = strconv.Itoa(int(toval))
				} else if (riskcommodity == "VMem") {
					fromval, _ = strconv.ParseFloat(responseAction["currentValue"].(string), 32)
					// Convert to GB
					fromval = (fromval/(1024*1024))
					toval, _ = strconv.ParseFloat(responseAction["resizeToValue"].(string), 32)
					// Convert to GB
					toval = (toval/(1024*1024))
					// Convert from float to int
					actionFrom = strconv.Itoa(int(fromval))
					actionTo = strconv.Itoa(int(toval))
				} else {
					actionFrom = "NA"
					actionTo = "NA"
				}
	
			}
			action.actionFrom = actionFrom
			action.actionTo = actionTo
			allActions = append(allResizeActions[serverName], action)
			allResizeActions[serverName] = allActions
			// add the server uuid to the map in case it's handy later.
			allActionServerUuids[serverName] = append(allActionServerUuids[serverName], serverUuid)

		}

		// Are there more actions to get from the API?
		cursor := res.Header.Get("x-next-cursor")
		if (len(cursor) > 0) {
			url = base_url + "?cursor="+cursor
			fmt.Printf("... still getting actions (cursor=%s) ...\n",cursor)
		} else {
			done = true
			//fmt.Println("DONE GETTING ACTIONS")
		}
	}
	
	return allResizeActions, allActionServerUuids 
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
