import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

'''
데이터베이스 설계 및 유지보수
경로수정 필요
'''
load_dotenv()

# DB 접속 정보 설정
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", 3306)
DB_DATABASE = os.getenv("DB_DATABASE")

BASE_DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}"
TARGET_DB_URL = f"{BASE_DB_URL}/{DB_DATABASE}"

def migrate_parquet_to_mysql():
    try:
        temp_engine = create_engine(BASE_DB_URL)
        with temp_engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{DB_DATABASE}`"))
            print(f"Step 1: Database '{DB_DATABASE}' is ready (created or already exists).")
        temp_engine.dispose()
    except Exception as e:
        print(f"Error during database creation: {e}")
        return

    engine = create_engine(TARGET_DB_URL)
    files = {
        'category_saturation': r'C:\Users\Playdata\Desktop\SKN29-2nd-1Team\data\processed\outputs\category_saturation.parquet',
        'trending_snapshots': r'C:\Users\Playdata\Desktop\SKN29-2nd-1Team\data\processed\outputs\trending_snapshots.parquet',
        'video_trending_events_24h_model' : r'C:\Users\Playdata\Desktop\SKN29-2nd-1Team\data\processed\outputs\video_trending_events_24h_model.parquet',
        'video_trending_events_T0_model' : r'C:\Users\Playdata\Desktop\SKN29-2nd-1Team\data\processed\outputs\video_trending_events_T0_model.parquet',
        'video_trending_events_analysis':r'C:\Users\Playdata\Desktop\SKN29-2nd-1Team\data\processed\outputs\video_trending_events_analysis.parquet'
                }

    for table_name, file_path in files.items():
        try:
            # 파일 존재 여부 확인
            if not os.path.exists(file_path):
                print(f"Warning: File not found at {file_path}. Skipping...")
                continue

            print(f"Processing {table_name}...")
            df = pd.read_parquet(file_path)
            # 데이터 삽입 (if_exists='replace'는 테이블을 삭제 후 새로 생성함)
            df.to_sql(name=table_name, con=engine, if_exists='replace', index=False)
            print(f"Successfully uploaded {table_name} to MySQL.")
        except Exception as e:
            print(f"Error processing {table_name}: {e}")

def update_constraints(engine):
    with engine.connect() as conn:
        print("Updating constraints and cleaning data...")
        
        # 1. NULL 데이터 보정 (안전 모드 해제 후 순차 실행)
        conn.execute(text("SET SQL_SAFE_UPDATES = 0;"))
        updates = [
            "UPDATE category_saturation SET prev_event_count = 0 WHERE prev_event_count IS NULL",
            "UPDATE category_saturation SET rolling_30d_max_prev = 0 WHERE rolling_30d_max_prev IS NULL",
            "UPDATE category_saturation SET rolling_30d_mean_prev = 0 WHERE rolling_30d_mean_prev IS NULL"
        ]
        for q in updates:
            conn.execute(text(q))
        conn.execute(text("SET SQL_SAFE_UPDATES = 1;"))

        # 2. Primary Key 추가 , TEXT 타입은 키 , 인덱스 등록 불가능 -> varchar로 변경
        pk_queries = [
            "ALTER TABLE trending_snapshots MODIFY COLUMN video_id VARCHAR(50)",
            "ALTER TABLE video_trending_events_analysis MODIFY COLUMN video_id VARCHAR(50)",
            "ALTER TABLE video_trending_events_analysis MODIFY COLUMN category_group VARCHAR(50)",

            "ALTER TABLE video_trending_events_T0_model MODIFY COLUMN video_id VARCHAR(50)",
            "ALTER TABLE video_trending_events_24h_model MODIFY COLUMN video_id VARCHAR(50)",
            "ALTER TABLE category_saturation MODIFY COLUMN category_group VARCHAR(50)",

            "ALTER TABLE trending_snapshots ADD PRIMARY KEY (video_id, collection_date)",  # 특정 영상의 특정 시각 (복합키)
            "ALTER TABLE video_trending_events_analysis ADD PRIMARY KEY (video_id, event_id)", # 6시간 공백을 기준으로 event_id
            "ALTER TABLE video_trending_events_T0_model ADD PRIMARY KEY (video_id, event_id)", # 예측 값과 실제 값을 join 해볼 수 있음
            "ALTER TABLE video_trending_events_24h_model ADD PRIMARY KEY (video_id, event_id)",
            "ALTER TABLE category_saturation ADD PRIMARY KEY (T0_date, category_group)" # 동일한 날짜에 동일한 카테고리 정보가 두번 들어오면 안됨
        ]
        for q in pk_queries:
            try:
                conn.execute(text(q))
            except Exception as e:
                print(f"PK 추가 중 건너뜀 (이미 존재할 수 있음): {e}")

        # 3. 인덱스 추가 (조회 성능 최적화)
        idx_queries = [
            "CREATE INDEX idx_snapshots_published ON trending_snapshots (published_at)",
            "CREATE INDEX idx_snapshots_category ON trending_snapshots (category_id)",
            "CREATE INDEX idx_analysis_date ON video_trending_events_analysis (T0_date)",
            "CREATE INDEX idx_analysis_category ON video_trending_events_analysis (category_group)"
        ]
        for q in idx_queries:
            try:
                conn.execute(text(q))
            except Exception as e:
                print(f"인덱스 추가 중 건너뜀: {e}")

        conn.commit()
        print("All constraints and indexes updated successfully.")
if __name__ == "__main__":
    migrate_parquet_to_mysql()
    target_engine = create_engine(TARGET_DB_URL)
    update_constraints(target_engine)