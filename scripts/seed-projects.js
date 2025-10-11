#!/usr/bin/env node
/**
 * Seed Projects Script
 * Creates sample projects and their variable values for development/testing
 *
 * Usage: npm run seed:projects
 */

require('dotenv').config();

const { connect: connectDb, close: closeDb } = require('../src/utils/db.util');
const { connect: connectMongoose, close: closeMongoose } = require('../src/utils/mongoose.util');
const Project = require('../src/models/Project.model');
const VariableValue = require('../src/models/VariableValue.model');
const logger = require('../src/utils/logger.util');

/**
 * Sample projects with their variable values
 */
const sampleProjects = [
  {
    id: 'tractatus',
    name: 'Tractatus AI Safety Framework',
    description: 'The Tractatus website - multi-project governance system with AI safety framework',
    techStack: {
      framework: 'Express.js',
      database: 'MongoDB',
      frontend: 'Vanilla JavaScript',
      css: 'Tailwind CSS'
    },
    repositoryUrl: 'https://github.com/example/tractatus',
    metadata: {
      environment: 'production',
      domain: 'tractatus.org'
    },
    active: true,
    variables: [
      { name: 'DB_NAME', value: 'tractatus_prod', description: 'Production database name', category: 'database' },
      { name: 'DB_PORT', value: '27017', description: 'MongoDB port', category: 'database' },
      { name: 'APP_PORT', value: '9000', description: 'Application HTTP port', category: 'config' },
      { name: 'API_BASE_URL', value: 'https://tractatus.org/api', description: 'Base URL for API', category: 'url' },
      { name: 'SESSION_SECRET', value: 'PROD_SECRET_KEY', description: 'Session encryption key', category: 'security' },
      { name: 'LOG_LEVEL', value: 'info', description: 'Logging verbosity', category: 'config' },
      { name: 'MAX_UPLOAD_SIZE', value: '10485760', description: 'Max file upload size (10MB)', category: 'config' }
    ]
  },
  {
    id: 'family-history',
    name: 'Family History Archive',
    description: 'Digital family archive with document management and OCR capabilities',
    techStack: {
      framework: 'Express.js',
      database: 'MongoDB',
      frontend: 'React',
      css: 'Tailwind CSS',
      storage: 'S3-compatible'
    },
    repositoryUrl: 'https://github.com/example/family-history',
    metadata: {
      environment: 'development',
      features: ['OCR', 'Document Management', 'Search']
    },
    active: true,
    variables: [
      { name: 'DB_NAME', value: 'family_history_dev', description: 'Development database name', category: 'database' },
      { name: 'DB_PORT', value: '27017', description: 'MongoDB port', category: 'database' },
      { name: 'APP_PORT', value: '3000', description: 'Application HTTP port', category: 'config' },
      { name: 'API_BASE_URL', value: 'http://localhost:3000/api', description: 'Base URL for API', category: 'url' },
      { name: 'STORAGE_BUCKET', value: 'family-history-documents', description: 'S3 bucket name', category: 'path' },
      { name: 'OCR_ENABLED', value: 'true', description: 'Enable OCR processing', category: 'feature_flag', dataType: 'boolean' },
      { name: 'MAX_UPLOAD_SIZE', value: '52428800', description: 'Max file upload size (50MB)', category: 'config' },
      { name: 'LOG_LEVEL', value: 'debug', description: 'Logging verbosity', category: 'config' }
    ]
  },
  {
    id: 'sydigital',
    name: 'SyDigital Platform',
    description: 'Digital transformation platform for enterprise solutions',
    techStack: {
      framework: 'Next.js',
      database: 'PostgreSQL',
      frontend: 'React',
      css: 'Styled Components',
      cache: 'Redis'
    },
    repositoryUrl: 'https://github.com/example/sydigital',
    metadata: {
      environment: 'staging',
      tier: 'enterprise'
    },
    active: true,
    variables: [
      { name: 'DB_NAME', value: 'sydigital_staging', description: 'Staging database name', category: 'database' },
      { name: 'DB_PORT', value: '5432', description: 'PostgreSQL port', category: 'database', dataType: 'number' },
      { name: 'APP_PORT', value: '3001', description: 'Application HTTP port', category: 'config' },
      { name: 'API_BASE_URL', value: 'https://staging.sydigital.com/api', description: 'Base URL for API', category: 'url' },
      { name: 'REDIS_URL', value: 'redis://localhost:6379', description: 'Redis connection URL', category: 'url' },
      { name: 'CACHE_TTL', value: '3600', description: 'Cache TTL in seconds', category: 'config', dataType: 'number' },
      { name: 'API_RATE_LIMIT', value: '1000', description: 'API requests per hour', category: 'config', dataType: 'number' },
      { name: 'LOG_LEVEL', value: 'warn', description: 'Logging verbosity', category: 'config' }
    ]
  },
  {
    id: 'example-project',
    name: 'Example Project',
    description: 'Template project for testing and demonstration purposes',
    techStack: {
      framework: 'Express.js',
      database: 'MongoDB',
      frontend: 'Vanilla JavaScript'
    },
    repositoryUrl: null,
    metadata: {
      environment: 'development',
      purpose: 'testing'
    },
    active: false, // Inactive to demonstrate filtering
    variables: [
      { name: 'DB_NAME', value: 'example_db', description: 'Example database', category: 'database' },
      { name: 'DB_PORT', value: '27017', description: 'MongoDB port', category: 'database' },
      { name: 'APP_PORT', value: '8080', description: 'Application port', category: 'config' }
    ]
  }
];

async function seedProjects() {
  try {
    console.log('\n=== Tractatus Projects & Variables Seed ===\n');

    // Connect to database (both native and Mongoose)
    await connectDb();
    await connectMongoose();

    // Get existing projects count
    const existingCount = await Project.countDocuments();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing project(s) in database.`);
      console.log('This will DELETE ALL existing projects and variables!');
      console.log('Continue? (yes/no): ');

      // Read from stdin
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('Cancelled. No changes made.');
        await cleanup();
        return;
      }

      // Delete all existing projects and variables
      await Project.deleteMany({});
      await VariableValue.deleteMany({});
      console.log('✅ Deleted all existing projects and variables.\n');
    }

    // Create projects and variables
    let createdCount = 0;
    let variableCount = 0;

    for (const projectData of sampleProjects) {
      const { variables, ...projectInfo } = projectData;

      // Create project
      const project = new Project({
        ...projectInfo,
        createdBy: 'seed-script',
        updatedBy: 'seed-script'
      });

      await project.save();
      createdCount++;

      console.log(`✅ Created project: ${project.name} (${project.id})`);

      // Create variables for this project
      if (variables && variables.length > 0) {
        for (const varData of variables) {
          const variable = new VariableValue({
            projectId: project.id,
            variableName: varData.name,
            value: varData.value,
            description: varData.description || '',
            category: varData.category || 'other',
            dataType: varData.dataType || 'string',
            active: true,
            createdBy: 'seed-script',
            updatedBy: 'seed-script'
          });

          await variable.save();
          variableCount++;
        }

        console.log(`   └─ Created ${variables.length} variable(s)`);
      }
    }

    console.log('\n=== Seed Complete ===');
    console.log(`✅ Created ${createdCount} projects`);
    console.log(`✅ Created ${variableCount} variables`);
    console.log('\nYou can now:');
    console.log('  - View projects: GET /api/admin/projects');
    console.log('  - View variables: GET /api/admin/projects/:projectId/variables');
    console.log('  - Test substitution: GET /api/admin/rules?projectId=tractatus');
    console.log('');

    logger.info(`Projects seeded: ${createdCount} projects, ${variableCount} variables`);

  } catch (error) {
    console.error('\n❌ Error seeding projects:', error.message);
    logger.error('Projects seed error:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

async function cleanup() {
  await closeDb();
  await closeMongoose();
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n👋 Cancelled by user');
  await cleanup();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  seedProjects();
}

module.exports = seedProjects;
