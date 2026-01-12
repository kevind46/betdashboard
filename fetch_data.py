
import nfl_data_py as nfl
import json
import pandas as pd
import os

print("Fetching 2025 data...")

# Create data directory
os.makedirs('src/data', exist_ok=True)

try:
    # Fetch seasonal data
    seasonal = nfl.import_seasonal_data([2025])
    print("Seasonal data shape:", seasonal.shape)
    
    # Save raw seasonal data to inspect columns
    seasonal.to_json('src/data/raw_seasonal_stats.json', orient='records')
    print("Saved src/data/raw_seasonal_stats.json")

    # Fetch weekly data just in case
    # weekly = nfl.import_weekly_data([2025])
    # weekly.to_json('src/data/raw_weekly_stats.json', orient='records')
    # print("Saved src/data/raw_weekly_stats.json")
    
except Exception as e:
    print(f"Error fetching data: {e}")
