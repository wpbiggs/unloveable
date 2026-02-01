const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const assert = require('assert');

describe('CI Workflow', () => {
  it('should have a valid YAML syntax', () => {
    const workflowPath = path.join(__dirname, '../.github/workflows/ci.yml');
    const fileContents = fs.readFileSync(workflowPath, 'utf8');
    try {
      const doc = yaml.load(fileContents);
      assert.ok(doc, 'YAML should be parsed successfully');
      assert.ok(doc.name, 'Workflow should have a name');
      assert.ok(doc.on, 'Workflow should have triggers');
      assert.ok(doc.jobs, 'Workflow should have jobs');
    } catch (e) {
      assert.fail(`YAML parsing failed: ${e.message}`);
    }
  });

  it('should include lint and test steps', () => {
    const workflowPath = path.join(__dirname, '../.github/workflows/ci.yml');
    const fileContents = fs.readFileSync(workflowPath, 'utf8');
    const doc = yaml.load(fileContents);
    
    const jobs = doc.jobs;
    assert.ok(jobs.build, 'Should have a build job');
    
    const steps = jobs.build.steps;
    const hasLint = steps.some(step => step.run && step.run.includes('npm run lint'));
    const hasTest = steps.some(step => step.run && step.run.includes('npm run test'));
    
    assert.ok(hasLint, 'Should run lint');
    assert.ok(hasTest, 'Should run tests');
  });
});
