from flask import Flask, request, jsonify
from pytrends.request import TrendReq
from flask_cors import CORS
import logging

# =================== #
# Config & App Setup  #
# =================== #
DEFAULT_KEYWORDS = ['AI', 'ChatGPT']
DEFAULT_TIMEFRAME = 'now 7-d'
VALID_TIMEFRAMES = [
    'now 1-H', 'now 4-H', 'now 1-d', 'now 7-d', 'today 1-m', 'today 3-m',
    'today 12-m', 'today+5-y', 'all'
]

app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =================== #
# Utility Functions   #
# =================== #
def parse_keywords(keyword_str):
    return [kw.strip() for kw in keyword_str.split(',') if kw.strip()]

def is_valid_timeframe(timeframe):
    return timeframe in VALID_TIMEFRAMES

def get_trending_keywords(keywords, timeframe=DEFAULT_TIMEFRAME):
    pytrends = TrendReq()

    if len(keywords) < 2:
        keywords.append('news')

    logger.info(f"Building payload with keywords={keywords}, timeframe={timeframe}")
    pytrends.build_payload(keywords, timeframe=timeframe)

    related_queries = pytrends.related_queries()
    logger.info(f"Raw related_queries response: {related_queries}")

    if not related_queries:
        logger.warning("No related queries returned.")
        return {kw: {'top': [], 'rising': []} for kw in keywords}

    output = {}
    for kw, data in related_queries.items():
        if data is None:
            logger.warning(f"No data for keyword: {kw}")
            output[kw] = {'top': [], 'rising': []}
            continue

        output[kw] = {
            'top': data['top'].to_dict(orient='records') if data.get('top') is not None else [],
            'rising': data['rising'].to_dict(orient='records') if data.get('rising') is not None else []
        }
    return output




# =================== #
# Routes              #
# =================== #
@app.route('/trends', methods=['GET'])
def trends():
    keyword_str = request.args.get('keywords', ','.join(DEFAULT_KEYWORDS))
    keywords = parse_keywords(keyword_str)
    timeframe = request.args.get('timeframe', DEFAULT_TIMEFRAME)

    if not keywords:
        return jsonify({'error': 'No valid keywords provided.'}), 400

    if not is_valid_timeframe(timeframe):
        return jsonify({'error': f'Invalid timeframe. Valid options are: {", ".join(VALID_TIMEFRAMES)}'}), 400

    try:
        logger.info(f"Fetching trends for keywords={keywords}, timeframe={timeframe}")
        result = get_trending_keywords(keywords, timeframe)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching trends: {e}")
        return jsonify({'error': 'Failed to fetch trends', 'details': str(e)}), 500

# =================== #
# Run App             #
# =================== #
if __name__ == '__main__':
    app.run(port=3333, debug=True)
