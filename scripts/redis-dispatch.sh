redis-cli ZRANGE 'bull:dispatch-post:wait' 0 -1 WITHSCORES
echo "---active---"
redis-cli ZRANGE 'bull:dispatch-post:active' 0 -1 WITHSCORES
echo "---delayed---"
redis-cli ZRANGE 'bull:dispatch-post:delayed' 0 -1 WITHSCORES
echo "---failed---"
redis-cli ZRANGE 'bull:dispatch-post:failed' 0 -1 WITHSCORES
echo "---prioritized---"
redis-cli ZRANGE 'bull:dispatch-post:prioritized' 0 -1 WITHSCORES
echo "---repeat---"
redis-cli ZRANGE 'bull:dispatch-post:repeat' 0 -1 WITHSCORES
echo "---stalled---"
redis-cli ZRANGE 'bull:dispatch-post:stalled' 0 -1 WITHSCORES
echo "---completed---"
redis-cli ZCARD 'bull:dispatch-post:completed'
