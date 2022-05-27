#!/bin/sh
export HISTIGNORE='*sudo -S*'
echo juno | sudo -S -k docker exec dgraph-alpha ls -l export/*/
echo juno | sudo -S -k docker cp dgraph-alpha:/dgraph/export .
echo juno | sudo -S -k chown -R kaiz:kaiz export
echo juno | sudo -S -k docker exec dgraph-alpha rm -rf export
echo \n
cp -r export/*/* data/
rm -rf export