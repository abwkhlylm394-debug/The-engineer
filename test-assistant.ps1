Start-Sleep -Seconds 3

Write-Host "Testing assistant endpoint..."

# Test 1: Services question
$body1 = @{message="What services do you offer?"} | ConvertTo-Json
$response1 = Invoke-RestMethod -Uri "http://localhost:3000/api/assistant" -Method POST -ContentType "application/json" -Body $body1
Write-Host "`nTest 1 - Services:"
$response1 | ConvertTo-Json

# Test 2: Projects question
$body2 = @{message="Tell me about your projects"} | ConvertTo-Json
$response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/assistant" -Method POST -ContentType "application/json" -Body $body2
Write-Host "`nTest 2 - Projects:"
$response2 | ConvertTo-Json

# Test 3: General greeting
$body3 = @{message="Hello"} | ConvertTo-Json
$response3 = Invoke-RestMethod -Uri "http://localhost:3000/api/assistant" -Method POST -ContentType "application/json" -Body $body3
Write-Host "`nTest 3 - General:"
$response3 | ConvertTo-Json

# Test 4: Missing message (should return 400)
Write-Host "`nTest 4 - Missing message (should error):"
try {
  $body4 = @{} | ConvertTo-Json
  $response4 = Invoke-RestMethod -Uri "http://localhost:3000/api/assistant" -Method POST -ContentType "application/json" -Body $body4
} catch {
  Write-Host "Error: $($_.Exception.Message)"
}

# Test 5: Message too long (should return 400)
Write-Host "`nTest 5 - Message too long (should error):"
try {
  $longMessage = "a" * 2001
  $body5 = @{message=$longMessage} | ConvertTo-Json
  $response5 = Invoke-RestMethod -Uri "http://localhost:3000/api/assistant" -Method POST -ContentType "application/json" -Body $body5
} catch {
  Write-Host "Error: $($_.Exception.Message)"
}

Write-Host "`nAll tests completed!"
